import sys
from pathlib import Path

# Add project root to sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import os
import pytest
import fitz
from fastapi.testclient import TestClient

from main import app
from database import init_db, SessionLocal, IssuedDocument, Base, engine
from ecc_engine import TraceMarkECC
from pdf_encoder import TraceMarkEncoder

client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def setup_environment():
    """Initializes database and creates a test PDF."""
    # Force drop all tables to clear any stale schema before testing
    Base.metadata.drop_all(bind=engine)
    init_db()
    
    test_pdf = Path("test_sample.pdf")
    
    # Create a 1-page sample PDF with text
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text(
        fitz.Point(72, 100),
        "CONFIDENTIAL EXAM PAPER - SUBJECT: COMPUTER SCIENCE - QUESTION 1: WHAT IS AN OPERATING SYSTEM?",
        fontsize=12,
        fontname="helv"
    )
    doc.save(str(test_pdf))
    doc.close()

    yield

    # Cleanup test files
    if test_pdf.exists():
        os.remove(test_pdf)
    if Path("test_encoded.pdf").exists():
        os.remove("test_encoded.pdf")

def test_ecc_roundtrip_and_corruption():
    """Tests metadata packing, bit conversion, and Reed-Solomon corruption recovery."""
    ecc = TraceMarkECC(ecc_symbols=16)
    metadata = {
        "exam_id": "NEET-2027",
        "press_id": "PRS-01",
        "batch_id": "B01",
        "center_id": "C101",
        "copy_number": 1234
    }

    # Encode
    bitstream = ecc.encode_to_bitstream(metadata)
    assert len(bitstream) > 0

    # Introduce synthetic bit flips (Simulate physical distortion)
    corrupted_stream = list(bitstream)
    corrupted_stream[10] = '1' if corrupted_stream[10] == '0' else '0'
    corrupted_stream[25] = '1' if corrupted_stream[25] == '0' else '0'
    corrupted_stream = "".join(corrupted_stream)

    # Decode & Verify Error Correction
    recovered_meta, err_count = ecc.decode_from_bitstream(corrupted_stream)
    assert recovered_meta["exam_id"] == "NEET-2027"
    assert recovered_meta["copy_number"] == 1234
    assert err_count > 0

def test_pdf_encoder_and_embedding_map():
    """Verifies layout micro-shifting, quality metrics, and DL embedding map output."""
    encoder = TraceMarkEncoder(shift_points=0.12, seed=42)
    metadata = {
        "exam_id": "UPSC-2026",
        "press_id": "PRS-09",
        "batch_id": "B002",
        "center_id": "C505",
        "copy_number": 999
    }

    report = encoder.encode_pdf(
        input_pdf_path="test_sample.pdf",
        output_pdf_path="test_encoded.pdf",
        metadata=metadata
    )

    assert report["pages_encoded"] == 1
    assert report["visual_quality"]["ssim"] > 0.95
    assert "embedding_map" in report
    assert len(report["embedding_map"]) > 0

def test_fastapi_encode_endpoint():
    """Tests the /api/v1/encode REST route and DB audit logging."""
    with open("test_sample.pdf", "rb") as pdf_file:
        response = client.post(
            "/api/v1/encode",
            data={
                "exam_id": "NEET-2027-PHY",
                "press_id": "PRS-017",
                "batch_id": "B042",
                "center_id": "C404",
                "copy_number": 8731,
                "shift_points": 0.12
            },
            files={"file": ("test_sample.pdf", pdf_file, "application/pdf")}
        )

    assert response.status_code == 200
    json_data = response.json()
    assert json_data["status"] == "SUCCESS"
    assert "download_url" in json_data

def test_fastapi_decode_mock_endpoint():
    """Tests the /api/v1/decode mock route for frontend UI integration."""
    dummy_img_path = Path("test_upload.jpg")
    dummy_img_path.write_bytes(b"\xFF\xD8\xFF\xE0\x00\x10JFIF") 

    with open(dummy_img_path, "rb") as img_file:
        response = client.post(
            "/api/v1/decode?mock=true",
            files={"file": ("test_upload.jpg", img_file, "image/jpeg")}
        )

    assert response.status_code == 200
    json_data = response.json()
    assert json_data["status"] == "SUCCESS"
    assert json_data["metadata"]["center_id"] == "C404"

    if dummy_img_path.exists():
        os.remove(dummy_img_path)