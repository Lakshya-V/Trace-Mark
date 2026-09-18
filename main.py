import os
import uuid
import shutil
from pathlib import Path
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
import fitz

from database import init_db, get_db, IssuedDocument, ForensicScan
from ecc_engine import TraceMarkECC
from pdf_encoder import TraceMarkEncoder
from inference_pipeline import infer_trace_bits

# Initialize Storage Directories
ARTIFACTS_DIR = Path("./artifacts")
ENCODED_DIR = ARTIFACTS_DIR / "encoded"
UPLOADS_DIR = ARTIFACTS_DIR / "uploads"
ENCODED_DIR.mkdir(parents=True, exist_ok=True)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title="Trace-Mark Forensics API",
    description="Physical Steganography & Leak Provenance Web Service",
    version="1.0.0"
)

# Enable CORS for Frontend Development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    init_db()

@app.get("/")
def read_root():
    return {"service": "Trace-Mark Forensics API", "status": "ONLINE"}

@app.post("/api/v1/encode")
async def encode_document(
    exam_id: str = Form(...),
    press_id: str = Form(...),
    batch_id: str = Form(...),
    center_id: str = Form(...),
    copy_number: int = Form(...),
    shift_points: float = Form(0.12),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Ingests a raw PDF, embeds ECC metadata into text micro-spacing,
    persists an audit trail, and returns quality metrics + download link.
    """
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    doc_id = str(uuid.uuid4())
    temp_input_path = UPLOADS_DIR / f"raw_{doc_id}_{file.filename}"
    output_pdf_path = ENCODED_DIR / f"tracemark_{doc_id}_{file.filename}"

    # Save uploaded input PDF
    with open(temp_input_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Pre-flight check: Verify PDF contains text blocks
    try:
        doc = fitz.open(temp_input_path)
        text_content = "".join([page.get_text() for page in doc])
        doc.close()
        if len(text_content.strip()) < 20:
            raise HTTPException(
                status_code=400, 
                detail="PDF appears to be empty or image-only. Text-based PDF required."
            )
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=400, detail="Corrupted PDF file.")

    metadata = {
        "exam_id": exam_id,
        "press_id": press_id,
        "batch_id": batch_id,
        "center_id": center_id,
        "copy_number": copy_number
    }

    # Run Trace-Mark Layout Encoder
    try:
        encoder = TraceMarkEncoder(shift_points=shift_points)
        report = encoder.encode_pdf(
            input_pdf_path=str(temp_input_path),
            output_pdf_path=str(output_pdf_path),
            metadata=metadata
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Encoding failed: {str(e)}")

    # Persist Audit Log to Database
    db_record = IssuedDocument(
        exam_id=exam_id,
        press_id=press_id,
        batch_id=batch_id,
        center_id=center_id,
        copy_number=copy_number,
        sha256_hash=report["sha256_hash"],
        input_path=str(temp_input_path),
        output_path=str(output_pdf_path),
        payload_bits=report["payload_bits"],
        pages_encoded=report["pages_encoded"],
        shift_points=report["shift_points"],
        ssim_score=report["visual_quality"]["ssim"]
    )
    db.add(db_record)
    db.commit()
    db.refresh(db_record)

    return {
        "status": "SUCCESS",
        "document_id": db_record.id,
        "download_url": f"/api/v1/documents/{db_record.id}/download",
        "metadata": metadata,
        "quality_report": report
    }

@app.post("/api/v1/decode")
async def decode_document(
    file: UploadFile = File(...),
    mock: bool = Query(False, description="Enable mock payload response for frontend UI testing"),
    db: Session = Depends(get_db)
):
    """
    Ingests a smartphone photo of a leaked paper and recovers provenance metadata.
    """
    scan_id = str(uuid.uuid4())
    temp_image_path = UPLOADS_DIR / f"scan_{scan_id}_{file.filename}"

    with open(temp_image_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    if mock:
        # Mock payload response for Frontend UI building
        mock_scan = ForensicScan(
            scan_uuid=scan_id,
            uploaded_image_path=str(temp_image_path),
            detected_exam_id="NEET-2027-PHY",
            detected_press_id="PRS-017",
            detected_batch_id="B042",
            detected_center_id="C404",
            detected_copy_number=8731,
            confidence_score=0.96,
            bit_error_rate=0.02,
            ecc_corrections_made=1,
            status="SUCCESS"
        )
        db.add(mock_scan)
        db.commit()

        return {
            "status": "SUCCESS",
            "mock_mode": True,
            "confidence": 0.96,
            "bit_error_rate": 0.02,
            "metadata": {
                "exam_id": "NEET-2027-PHY",
                "press_id": "PRS-017",
                "batch_id": "B042",
                "center_id": "C404",
                "copy_number": 8731
            }
        }

    try:
        raw_results = infer_trace_bits(temp_image_path)
    except NotImplementedError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Forensic DL decoder service is not configured on backend branch."
        )

    return {"status": "PROCESSED", "data": raw_results}

@app.get("/api/v1/audit-logs")
def get_audit_logs(db: Session = Depends(get_db)):
    """Returns history of generated documents and forensic scans."""
    issued_docs = db.query(IssuedDocument).order_by(IssuedDocument.created_at.desc()).limit(50).all()
    scans = db.query(ForensicScan).order_by(ForensicScan.scanned_at.desc()).limit(50).all()
    return {
        "issued_documents": issued_docs,
        "forensic_scans": scans
    }

@app.get("/api/v1/documents/{doc_id}/download")
def download_document(doc_id: int, db: Session = Depends(get_db)):
    """Serves the generated fingerprinted PDF file."""
    record = db.query(IssuedDocument).filter(IssuedDocument.id == doc_id).first()
    if not record or not os.path.exists(record.output_path):
        raise HTTPException(status_code=404, detail="Document not found.")
    
    return FileResponse(
        path=record.output_path,
        filename=f"TraceMark_Copy_{record.copy_number}.pdf",
        media_type="application/pdf"
    )