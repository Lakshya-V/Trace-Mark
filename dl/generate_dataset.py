import os
import json
from pdf_encoder import TraceMarkEncoder

SOURCE_PDF = "encoded_large.pdf"
OUTPUT_DIR = "generated_documents"
NUM_DOCUMENTS = 10


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("=" * 60)
    print("TRACE-MARK MULTI-DOCUMENT GENERATOR")
    print("=" * 60)

    for i in range(NUM_DOCUMENTS):

        doc_id = f"DOC{i + 1:03d}"

        metadata = {
            "exam_id": f"EXAM{i + 1:08d}",
            "press_id": f"PRESS{i + 1:05d}",
            "batch_id": f"BATCH{i + 1:05d}",
            "center_id": f"CENTER{i + 1:05d}",
            "copy_id": i + 1
        }

        output_pdf = os.path.join(
            OUTPUT_DIR,
            f"{doc_id}.pdf"
        )

        output_map = os.path.join(
            OUTPUT_DIR,
            f"{doc_id}_map.json"
        )

        encoder = TraceMarkEncoder(
            shift_points=0.12,
            seed=1337 + i,
            dpi=144
        )

        result = encoder.encode_pdf(
            SOURCE_PDF,
            output_pdf,
            metadata
        )

        with open(output_map, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2)

        print(
            f"[{i + 1}/{NUM_DOCUMENTS}] "
            f"{doc_id} → {result['embedding_locations']} gaps"
        )

    print("=" * 60)
    print("DONE")
    print("=" * 60)


if __name__ == "__main__":
    main()