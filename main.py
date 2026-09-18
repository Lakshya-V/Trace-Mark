import os
import uuid
import shutil
from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException, status, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from passlib.context import CryptContext
import fitz
import jwt

# Rate Limiting
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from database import init_db, get_db, User, UserSession, IssuedDocument, ForensicScan, LeakFinding
from ecc_engine import TraceMarkECC
from pdf_encoder import TraceMarkEncoder
from inference_pipeline import infer_trace_bits

# Initialize Storage Directories
ARTIFACTS_DIR = Path("./artifacts")
ENCODED_DIR = ARTIFACTS_DIR / "encoded"
UPLOADS_DIR = ARTIFACTS_DIR / "uploads"
ENCODED_DIR.mkdir(parents=True, exist_ok=True)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="Trace-Mark API", version="1.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS configured for Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = "trace_mark_jwt_secret_dev" # Move to .env in production

@app.on_event("startup")
def on_startup():
    init_db()

# --- UTILS & DEPENDENCIES ---

def success_response(data: Any):
    return {"data": data}

def error_response(code: str, message: str, status_code: int):
    raise HTTPException(
        status_code=status_code,
        detail={"error": {"code": code, "message": message}}
    )

def get_current_user(request: Request, db: Session = Depends(get_db)):
    session_id = request.cookies.get("session_id")
    if not session_id:
        error_response("UNAUTHENTICATED", "Authentication required", 401)
    
    sess = db.query(UserSession).filter(UserSession.id == session_id).first()
    if not sess:
        error_response("UNAUTHENTICATED", "Session expired or invalid", 401)
        
    user = db.query(User).filter(User.id == sess.user_id).first()
    if not user:
        error_response("UNAUTHENTICATED", "User not found", 401)
    return user

# --- AUTHENTICATION ENDPOINTS ---

class AuthReq(BaseModel):
    email: str
    password: str
    name: Optional[str] = None

@app.post("/api/auth/register", status_code=201)
@limiter.limit("5/minute")
def register(request: Request, req: AuthReq, response: Response, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == req.email).first():
        error_response("CONFLICT", "Email already registered", 409)
    
    hashed = pwd_context.hash(req.password)
    user = User(name=req.name or "Analyst", email=req.email, password_hash=hashed)
    db.add(user)
    db.commit()
    db.refresh(user)

    new_sess = UserSession(user_id=user.id)
    db.add(new_sess)
    db.commit()

    response.set_cookie(key="session_id", value=new_sess.id, httponly=True, secure=False, samesite="lax")
    return success_response({"user": {"id": user.id, "name": user.name, "email": user.email}})

@app.post("/api/auth/login")
@limiter.limit("10/minute")
def login(request: Request, req: AuthReq, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not pwd_context.verify(req.password, user.password_hash):
        error_response("INVALID_CREDENTIALS", "Invalid email or password", 401)
        
    new_sess = UserSession(user_id=user.id)
    db.add(new_sess)
    db.commit()

    response.set_cookie(key="session_id", value=new_sess.id, httponly=True, secure=False, samesite="lax")
    return success_response({"user": {"id": user.id, "name": user.name, "email": user.email}})

@app.post("/api/auth/logout")
def logout(response: Response, request: Request, db: Session = Depends(get_db)):
    session_id = request.cookies.get("session_id")
    if session_id:
        db.query(UserSession).filter(UserSession.id == session_id).delete()
        db.commit()
    response.delete_cookie("session_id")
    return success_response({"message": "Logged out"})

@app.get("/api/auth/me")
def get_me(user: User = Depends(get_current_user)):
    return success_response({"user": {"id": user.id, "name": user.name, "email": user.email}})

# --- DASHBOARD & METRICS ---

@app.get("/api/dashboard/summary")
def get_dashboard_summary(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    total_traces = db.query(ForensicScan).filter(ForensicScan.user_id == user.id).count()
    active_leaks = db.query(LeakFinding).filter(LeakFinding.user_id == user.id, LeakFinding.status == "INVESTIGATING").count()
    
    recent = db.query(ForensicScan).filter(ForensicScan.user_id == user.id).order_by(ForensicScan.scanned_at.desc()).limit(5).all()
    
    return success_response({
        "metrics": {
            "total_traces": total_traces,
            "active_leaks": active_leaks,
            "system_health": "OPTIMAL"
        },
        "recent_activity": [{"scan_uuid": r.scan_uuid, "status": r.status, "date": r.scanned_at} for r in recent]
    })

# --- FORENSIC ENCODE/DECODE (Protected) ---

@app.post("/api/traces/encode")
async def encode_document(
    exam_id: str = Form(...),
    press_id: str = Form(...),
    batch_id: str = Form(...),
    center_id: str = Form(...),
    copy_number: int = Form(...),
    shift_points: float = Form(0.20),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if not file.filename.endswith(".pdf"):
        error_response("VALIDATION_ERROR", "Only PDF files are supported.", 400)

    doc_id = str(uuid.uuid4())
    temp_input = UPLOADS_DIR / f"raw_{doc_id}.pdf"
    output_pdf = ENCODED_DIR / f"encoded_{doc_id}.pdf"

    with open(temp_input, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        encoder = TraceMarkEncoder(shift_points=shift_points)
        report = encoder.encode_pdf(str(temp_input), str(output_pdf), {
            "exam_id": exam_id, "press_id": press_id, "batch_id": batch_id,
            "center_id": center_id, "copy_number": copy_number
        })
    except Exception as e:
        error_response("ENCODING_FAILED", str(e), 500)

    db_record = IssuedDocument(
        user_id=user.id, exam_id=exam_id, press_id=press_id, batch_id=batch_id,
        center_id=center_id, copy_number=copy_number, sha256_hash=report["sha256_hash"],
        input_path=str(temp_input), output_path=str(output_pdf),
        payload_bits=report["payload_bits"], pages_encoded=report["pages_encoded"],
        shift_points=report["shift_points"], ssim_score=report["visual_quality"]["ssim"]
    )
    db.add(db_record)
    db.commit()
    
    return success_response({
        "document_id": db_record.id,
        "download_url": f"/api/documents/{db_record.id}/download",
        "quality_report": report
    })

@app.post("/api/traces/decode")
async def decode_document(
    file: UploadFile = File(...),
    mock: bool = Query(False),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    scan_id = str(uuid.uuid4())
    temp_image = UPLOADS_DIR / f"scan_{scan_id}_{file.filename}"

    with open(temp_image, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    if mock:
        mock_scan = ForensicScan(
            user_id=user.id, scan_uuid=scan_id, uploaded_image_path=str(temp_image),
            detected_exam_id="NEET-2027-PHY", detected_press_id="PRS-017",
            detected_batch_id="B042", detected_center_id="C404", detected_copy_number=8731,
            confidence_score=0.96, bit_error_rate=0.02, ecc_corrections_made=1, status="SUCCESS"
        )
        db.add(mock_scan)
        db.commit()
        return success_response({"scan_uuid": scan_id, "metadata": {"exam_id": "NEET-2027-PHY", "center_id": "C404"}})

    try:
        raw_results = infer_trace_bits(temp_image)
        return success_response({"scan_uuid": scan_id, "results": raw_results})
    except NotImplementedError:
        error_response("SERVICE_UNAVAILABLE", "DL decoder not configured", 503)

@app.get("/api/traces")
def get_traces(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    scans = db.query(ForensicScan).filter(ForensicScan.user_id == user.id).order_by(ForensicScan.scanned_at.desc()).all()
    return success_response([{"id": s.id, "uuid": s.scan_uuid, "center": s.detected_center_id, "status": s.status} for s in scans])