import os
import csv
import json
import cv2
import fitz
import numpy as np

GENERATED_DIR = "generated_documents"
OUTPUT_DIR = "dataset"
PATCH_DIR = os.path.join(OUTPUT_DIR, "patches")

DPI = 144
PATCH_WIDTH = 128
PATCH_HEIGHT = 128


def extract_patch(image, x, y):
    scale = DPI / 72.0

    px = int(x * scale)
    py = int(y * scale)

    half_w = PATCH_WIDTH // 2
    half_h = PATCH_HEIGHT // 2

    x1 = px - half_w
    y1 = py - half_h
    x2 = px + half_w
    y2 = py + half_h

    patch = np.full(
        (PATCH_HEIGHT, PATCH_WIDTH),
        255,
        dtype=np.uint8
    )

    sx1 = max(0, x1)
    sy1 = max(0, y1)
    sx2 = min(image.shape[1], x2)
    sy2 = min(image.shape[0], y2)

    if sx1 >= sx2 or sy1 >= sy2:
        return patch

    crop = image[sy1:sy2, sx1:sx2]

    dx1 = sx1 - x1
    dy1 = sy1 - y1

    patch[
        dy1:dy1 + crop.shape[0],
        dx1:dx1 + crop.shape[1]
    ] = crop

    return patch


def main():

    print("=" * 60)
    print("TRACE-MARK 15K DATASET BUILDER")
    print("=" * 60)

    os.makedirs(PATCH_DIR, exist_ok=True)

    labels_path = os.path.join(
        OUTPUT_DIR,
        "labels.csv"
    )

    csv_file = open(
        labels_path,
        "w",
        newline="",
        encoding="utf-8"
    )

    writer = csv.writer(csv_file)

    writer.writerow([
        "filename",
        "document",
        "page",
        "gap_index",
        "bit",
        "shift",
        "word"
    ])

    total = 0
    failed = 0

    pdf_files = sorted(
        f for f in os.listdir(GENERATED_DIR)
        if f.lower().endswith(".pdf")
    )

    print(f"Documents found: {len(pdf_files)}")

    for doc_num, pdf_name in enumerate(pdf_files):

        pdf_path = os.path.join(
            GENERATED_DIR,
            pdf_name
        )

        map_name = pdf_name.replace(
            ".pdf",
            "_map.json"
        )

        map_path = os.path.join(
            GENERATED_DIR,
            map_name
        )

        print(
            f"\n[{doc_num + 1}/{len(pdf_files)}] "
            f"{pdf_name}"
        )

        with open(
            map_path,
            "r",
            encoding="utf-8"
        ) as f:
            metadata = json.load(f)

        embedding_map = metadata["embedding_map"]

        doc = fitz.open(pdf_path)

        pages = []

        zoom = DPI / 72.0
        matrix = fitz.Matrix(zoom, zoom)

        for page in doc:

            pix = page.get_pixmap(
                matrix=matrix,
                colorspace=fitz.csGRAY,
                alpha=False
            )

            image = np.frombuffer(
                pix.samples,
                dtype=np.uint8
            ).reshape(
                pix.height,
                pix.width
            )

            pages.append(image)

        for item in embedding_map:

            page_index = item["page"]

            bit = int(item["bit"])
            shift = float(item["shift"])

            x = float(item["x"])
            y = float(item["y"])

            word = item["word"]

            patch = extract_patch(
                pages[page_index],
                x,
                y
            )

            filename = f"{total:06d}.png"

            output_path = os.path.join(
                PATCH_DIR,
                filename
            )

            success = cv2.imwrite(
                output_path,
                patch
            )

            if not success:
                failed += 1
                continue

            writer.writerow([
                filename,
                pdf_name.replace(".pdf", ""),
                page_index,
                item["gap_index"],
                bit,
                shift,
                word
            ])

            total += 1

        doc.close()

        print(
            f"  Patches generated: {len(embedding_map)}"
        )

    csv_file.close()

    print("\n" + "=" * 60)
    print("DATASET COMPLETE")
    print("=" * 60)

    print(f"Total patches : {total}")
    print(f"Failed        : {failed}")
    print(f"Output        : {os.path.abspath(OUTPUT_DIR)}")


if __name__ == "__main__":
    main()