import os
import fitz
import json
from pdf_encoder import TraceMarkEncoder

GEN_DIR = "generated_documents"
os.makedirs(GEN_DIR, exist_ok=True)

def create_exam_pdf(filename):
    doc = fitz.open()
    paragraph_lines = [
        "The rapid advancement of artificial intelligence and machine learning",
        "has fundamentally altered the landscape of modern computing. When designing",
        "scalable distributed systems, engineers must carefully consider the trade-offs",
        "between latency, throughput, and fault tolerance. In the context of physical",
        "steganography, the primary challenge is overcoming the physical channel noise",
        "introduced by printers and smartphone cameras. This requires highly robust",
        "error correction mechanisms, such as Reed-Solomon coding, combined with",
        "deep learning-based document dewarping and residual feature extraction to",
        "reliably recover the embedded cryptographic payloads."
    ]
    for i in range(4):
        page = doc.new_page()
        y_pos = 50
        page.insert_text(fitz.Point(50, y_pos), f"CONFIDENTIAL EXAM - PAGE {i+1}", fontsize=11, fontname="helv")
        y_pos += 30
        for q in range(1, 13):
            page.insert_text(fitz.Point(50, y_pos), f"QUESTION {q + (i*12)}:", fontsize=11, fontname="helv")
            y_pos += 15
            for line in paragraph_lines:
                page.insert_text(fitz.Point(50, y_pos), line, fontsize=11, fontname="helv")
                y_pos += 15
            y_pos += 10
    doc.save(filename)
    doc.close()

if __name__ == "__main__":
    encoder = TraceMarkEncoder(shift_points=0.20, seed=1337)
    for idx in range(1, 6):
        raw_pdf = f"raw_{idx}.pdf"
        enc_pdf = os.path.join(GEN_DIR, f"DOC{idx:03d}_encoded.pdf")
        json_map = os.path.join(GEN_DIR, f"DOC{idx:03d}_encoded_map.json")

        create_exam_pdf(raw_pdf)
        metadata = {
            "exam_id": f"EXAM-2027-{idx}",
            "press_id": "PRS-01",
            "batch_id": "B99",
            "center_id": f"C{400+idx}",
            "copy_number": 8000 + idx
        }
        report = encoder.encode_pdf(raw_pdf, enc_pdf, metadata)
        with open(json_map, "w") as f:
            json.dump({
                "payload_bits": report["payload_bits"],
                "embedding_locations": report["embedding_locations"],
                "embedding_map": report["embedding_map"]
            }, f, indent=2)
        if os.path.exists(raw_pdf):
            os.remove(raw_pdf)
        print(f"Generated {enc_pdf} ({report['embedding_locations']} gaps)")