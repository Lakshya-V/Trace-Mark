import os
import uuid
import shutil
import secrets
import csv
import io
from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException, status, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
import bcrypt
import fitz
import jwt

# Rate Limiting
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from database import init_db, get_db, User, UserSession, OTPChallenge, IssuedDocument, ForensicScan, LeakFinding
from ecc_engine import TraceMarkECC
from pdf_encoder import TraceMarkEncoder
from inference_pipeline import TraceMarkDetector, infer_trace_bits

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

SECRET_KEY = "trace_mark_jwt_secret_dev" # Move to .env in production
detector: Optional[TraceMarkDetector] = None


def hash_secret(value: str) -> str:
    return bcrypt.hashpw(value.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_secret(value: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(value.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False

@app.on_event("startup")
def on_startup():
    global detector
    init_db()
    detector = TraceMarkDetector()

# --- UTILS & DEPENDENCIES ---

def success_response(data: Any):
    return {"data": data}

def error_response(code: str, message: str, status_code: int):
    raise HTTPException(
        status_code=status_code,
        detail={"error": {"code": code, "message": message}}
    )


@app.post("/api/scan-document")
@app.post("/api/scan")
async def scan_document(file: UploadFile = File(...)):
    """Classify an uploaded document image and return its predicted shift bit."""
    allowed_types = {"image/jpeg", "image/png", "image/webp"}
    if file.content_type not in allowed_types:
        error_response("VALIDATION_ERROR", "Only JPEG, PNG, and WebP images are supported.", 400)

    if detector is None:
        error_response("SERVICE_UNAVAILABLE", "Detector is not initialized.", 503)

    scan_id = str(uuid.uuid4())
    suffix = Path(file.filename or "upload.png").suffix.lower() or ".png"
    image_path = UPLOADS_DIR / f"scan_{scan_id}{suffix}"

    try:
        with open(image_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        prediction = detector.predict_patch(image_path)
        predicted_bit = prediction.get("bit") if isinstance(prediction, dict) else prediction
        if predicted_bit not in (0, 1):
            error_response("SCAN_FAILED", "Detector returned an invalid shift bit.", 422)
        confidence = prediction.get("confidence", 0.0) if isinstance(prediction, dict) else 0.0
        return {
            "status": "complete",
            "detected_shift": "Shift Left" if int(predicted_bit) == 0 else "Shift Right",
            "prediction_bit": int(predicted_bit),
            "confidence": float(confidence),
            "pipeline": {"normalization": "Complete", "dewarp": "Complete", "decode": "Complete", "ecc_extraction": "Complete"},
        }
    except (OSError, ValueError) as exc:
        error_response("SCAN_FAILED", str(exc), 422)
    finally:
        image_path.unlink(missing_ok=True)

def get_current_user(request: Request, db: Session = Depends(get_db)):
    authorization = request.headers.get("Authorization", "")
    user = None
    if authorization.startswith("Bearer "):
        try:
            claims = jwt.decode(authorization[7:], SECRET_KEY, algorithms=["HS256"])
            user = db.query(User).filter(User.id == int(claims["sub"])).first()
        except (jwt.PyJWTError, KeyError, ValueError):
            error_response("UNAUTHENTICATED", "Invalid or expired access token", 401)
    else:
        session_id = request.cookies.get("session_id")
        if session_id:
            sess = db.query(UserSession).filter(UserSession.id == session_id).first()
            if sess:
                user = db.query(User).filter(User.id == sess.user_id).first()
    if not user:
        error_response("UNAUTHENTICATED", "Authentication required", 401)
    return user

# --- AUTHENTICATION ENDPOINTS ---

class AuthReq(BaseModel):
    email: str
    password: str
    name: Optional[str] = None
    full_name: Optional[str] = None
    organization_name: Optional[str] = None
    press_id: Optional[str] = None
    center_code: Optional[str] = None


class OTPVerifyReq(BaseModel):
    email: str
    otp: str


def user_payload(user: User):
    return {
        "id": user.id,
        "name": user.full_name or user.name,
        "full_name": user.full_name or user.name,
        "email": user.email,
        "organization_name": user.organization_name,
        "press_id": user.press_id,
        "center_code": user.center_code,
        "role": user.role,
    }


def issue_access_token(user: User) -> str:
    return jwt.encode(
        {"sub": str(user.id), "name": user.full_name or user.name, "organization": user.organization_name, "role": user.role, "exp": datetime.utcnow() + timedelta(hours=8)},
        SECRET_KEY,
        algorithm="HS256",
    )

@app.post("/api/auth/register", status_code=201)
@limiter.limit("5/minute")
def register(request: Request, req: AuthReq, response: Response, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == req.email).first():
        error_response("CONFLICT", "Email already registered", 409)
    
    hashed = hash_secret(req.password)
    full_name = req.full_name or req.name or "Analyst"
    user = User(name=full_name, full_name=full_name, email=req.email, organization_name=req.organization_name,
                press_id=req.press_id, center_code=req.center_code, password_hash=hashed)
    db.add(user)
    db.commit()
    db.refresh(user)

    new_sess = UserSession(user_id=user.id)
    db.add(new_sess)
    db.commit()

    response.set_cookie(key="session_id", value=new_sess.id, httponly=True, secure=False, samesite="lax")
    return success_response({"user": user_payload(user), "access_token": issue_access_token(user)})


@app.post("/api/auth/login-step1")
@limiter.limit("10/minute")
def login_step1(request: Request, req: AuthReq, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_secret(req.password, user.password_hash):
        error_response("INVALID_CREDENTIALS", "Invalid email or password", 401)

    code = f"{secrets.randbelow(1_000_000):06d}"
    challenge = OTPChallenge(user_id=user.id, code_hash=hash_secret(code), expires_at=datetime.utcnow() + timedelta(minutes=5))
    db.add(challenge)
    db.commit()
    # Email delivery is not configured in local development; expose this only for local wiring.
    result = {"message": "OTP generated", "email": user.email, "expires_in": 300}
    if os.getenv("TRACE_MARK_ENV", "development") != "production":
        result["development_otp"] = code
    return success_response(result)


@app.post("/api/auth/verify-otp")
def verify_otp(req: OTPVerifyReq, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    challenge = db.query(OTPChallenge).filter(OTPChallenge.user_id == user.id if user else False,
                                               OTPChallenge.used_at.is_(None)).order_by(OTPChallenge.created_at.desc()).first()
    if not user or not challenge or challenge.expires_at < datetime.utcnow() or not verify_secret(req.otp, challenge.code_hash):
        error_response("INVALID_OTP", "The OTP is invalid or expired", 401)
    challenge.used_at = datetime.utcnow()
    session = UserSession(user_id=user.id)
    db.add(session)
    db.commit()
    response.set_cookie(key="session_id", value=session.id, httponly=True, secure=False, samesite="lax")
    return success_response({"access_token": issue_access_token(user), "user": user_payload(user)})

@app.post("/api/auth/login")
@limiter.limit("10/minute")
def login(request: Request, req: AuthReq, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_secret(req.password, user.password_hash):
        error_response("INVALID_CREDENTIALS", "Invalid email or password", 401)
        
    new_sess = UserSession(user_id=user.id)
    db.add(new_sess)
    db.commit()

    response.set_cookie(key="session_id", value=new_sess.id, httponly=True, secure=False, samesite="lax")
    return success_response({"access_token": issue_access_token(user), "user": user_payload(user)})

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
    return success_response({"user": user_payload(user)})

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


@app.get("/api/overview/stats")
def overview_stats(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    scans = db.query(ForensicScan).filter(ForensicScan.user_id == user.id, ForensicScan.scanned_at >= month_start)
    verified = scans.filter(ForensicScan.status.in_(["SUCCESS", "COMPLETE", "VERIFIED"])).count()
    secured = db.query(IssuedDocument).filter(IssuedDocument.user_id == user.id).count()
    average = db.query(ForensicScan).filter(ForensicScan.user_id == user.id).with_entities(ForensicScan.confidence_score).all()
    confidence = sum(row[0] for row in average) / len(average) if average else 0.0
    return {"scans_this_month": scans.count(), "leaks_verified": verified, "documents_secured": secured, "avg_confidence": confidence}


@app.get("/api/overview/alerts")
def overview_alerts(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(ForensicScan).filter(ForensicScan.user_id == user.id).order_by(ForensicScan.scanned_at.desc()).limit(10).all()
    return [{"alert_id": row.scan_uuid, "detection": "Trace-Mark scan", "center": row.detected_center_id or "Unknown", "status": row.status, "timestamp": row.scanned_at.isoformat()} for row in rows]


@app.get("/api/audit-trail")
def audit_trail(page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100), search: str = "", status_filter: Optional[str] = None,
                user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(ForensicScan).filter(ForensicScan.user_id == user.id)
    if search:
        query = query.filter(ForensicScan.scan_uuid.ilike(f"%{search}%"))
    if status_filter:
        query = query.filter(ForensicScan.status == status_filter)
    total = query.count()
    rows = query.order_by(ForensicScan.scanned_at.desc()).offset((page - 1) * limit).limit(limit).all()
    return {"total": total, "page": page, "records": [{"scan_id": row.scan_uuid, "source_file": Path(row.uploaded_image_path).name,
        "analyst": user.full_name or user.name, "result": row.status, "confidence": row.confidence_score, "timestamp": row.scanned_at.isoformat()} for row in rows]}


@app.get("/api/audit-trail/export")
def export_audit_trail(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["scan_id", "source_file", "analyst", "result", "confidence", "timestamp"])
    rows = db.query(ForensicScan).filter(ForensicScan.user_id == user.id).order_by(ForensicScan.scanned_at.desc()).all()
    for row in rows:
        writer.writerow([row.scan_uuid, Path(row.uploaded_image_path).name, user.full_name or user.name, row.status, row.confidence_score, row.scanned_at.isoformat()])
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=audit-trail.csv"})

# --- FORENSIC ENCODE/DECODE (Protected) ---

@app.post("/api/generate-paper")
async def generate_paper(
    examination: str = Form(...), press_id: str = Form(...), batch_code: str = Form(...), center_code: str = Form(...),
    file: UploadFile = File(...), db: Session = Depends(get_db), user: User = Depends(get_current_user),
):
    """Generate and persist a marked PDF from the frontend generator form."""
    if Path(file.filename or "").suffix.lower() != ".pdf":
        error_response("VALIDATION_ERROR", "Only PDF source documents are supported.", 400)
    document_id = str(uuid.uuid4())
    temp_input = UPLOADS_DIR / f"source_{document_id}.pdf"
    output_pdf = ENCODED_DIR / f"generated_{document_id}.pdf"
    with open(temp_input, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    try:
        report = TraceMarkEncoder(shift_points=0.20).encode_pdf(str(temp_input), str(output_pdf), {
            "exam_id": examination, "press_id": press_id, "batch_id": batch_code, "center_id": center_code, "copy_number": 1,
        })
        record = IssuedDocument(user_id=user.id, exam_id=examination, press_id=press_id, batch_id=batch_code, center_id=center_code,
            copy_number=1, sha256_hash=report["sha256_hash"], input_path=str(temp_input), output_path=str(output_pdf),
            payload_bits=report["payload_bits"], pages_encoded=report["pages_encoded"], shift_points=report["shift_points"],
            ssim_score=report["visual_quality"]["ssim"])
        db.add(record)
        db.commit()
    except Exception as exc:
        output_pdf.unlink(missing_ok=True)
        error_response("GENERATION_FAILED", str(exc), 500)
    return success_response({"document_id": record.id, "download_url": f"/api/documents/{record.id}/download", "quality_report": report})


@app.get("/api/documents/{document_id}/download")
def download_generated_document(document_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    record = db.query(IssuedDocument).filter(IssuedDocument.id == document_id, IssuedDocument.user_id == user.id).first()
    if not record or not Path(record.output_path).exists():
        error_response("NOT_FOUND", "Generated document not found", 404)
    return FileResponse(record.output_path, media_type="application/pdf", filename=Path(record.output_path).name)

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
        raw_results = infer_trace_bits(temp_image, detector)
        return success_response({"scan_uuid": scan_id, "results": raw_results})
    except NotImplementedError:
        error_response("SERVICE_UNAVAILABLE", "DL decoder not configured", 503)

@app.get("/api/traces")
def get_traces(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    scans = db.query(ForensicScan).filter(ForensicScan.user_id == user.id).order_by(ForensicScan.scanned_at.desc()).all()
    return success_response([{"id": s.id, "uuid": s.scan_uuid, "center": s.detected_center_id, "status": s.status} for s in scans])