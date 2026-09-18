"""Generate Trace-Mark training pages and physical-channel augmentations."""

from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

import cv2
import fitz
import numpy as np

from ecc_engine import TracePayload, encode_payload
from pdf_encoder import encode_pdf


def _augment(image: np.ndarray, rng: random.Random) -> np.ndarray:
    height, width = image.shape[:2]
    angle = rng.uniform(-4, 4)
    scale = rng.uniform(0.96, 1.04)
    matrix = cv2.getRotationMatrix2D((width / 2, height / 2), angle, scale)
    matrix[:, 2] += [rng.uniform(-6, 6), rng.uniform(-6, 6)]
    image = cv2.warpAffine(image, matrix, (width, height), borderValue=255)
    if rng.random() < 0.7:
        image = cv2.GaussianBlur(image, (3, 3), rng.uniform(0.2, 1.2))
    if rng.random() < 0.7:
        contrast, brightness = rng.uniform(0.8, 1.2), rng.uniform(-18, 18)
        image = np.clip(image.astype(np.float32) * contrast + brightness, 0, 255).astype(np.uint8)
    if rng.random() < 0.5:
        shadow = np.tile(np.linspace(0.72, 1.0, width, dtype=np.float32), (height, 1))
        image = np.clip(image.astype(np.float32) * shadow, 0, 255).astype(np.uint8)
    if rng.random() < 0.7:
        noise = rng.uniform(1.0, 8.0) * np.random.default_rng(rng.randrange(1_000_000)).standard_normal(image.shape)
        image = np.clip(image.astype(np.float32) + noise, 0, 255).astype(np.uint8)
    if rng.random() < 0.5:
        quality = rng.randint(35, 90)
        ok, encoded = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, quality])
        if ok:
            image = cv2.imdecode(encoded, cv2.IMREAD_GRAYSCALE)
    if rng.random() < 0.25:
        crop_height, crop_width = int(height * 0.12), int(width * 0.2)
        y, x = rng.randrange(max(1, height - crop_height)), rng.randrange(max(1, width - crop_width))
        image[y : y + crop_height, x : x + crop_width] = 255
    return image


def _render(pdf_path: Path) -> np.ndarray:
    with fitz.open(pdf_path) as document:
        pixmap = document[0].get_pixmap(matrix=fitz.Matrix(1, 1), colorspace=fitz.csGRAY, alpha=False)
        return np.frombuffer(pixmap.samples, dtype=np.uint8).reshape(pixmap.height, pixmap.width).copy()


def _source_pdf(path: Path, lines: int = 45) -> None:
    words = "Trace Mark exam question answer analysis center press batch document provenance"
    with fitz.open() as document:
        page = document.new_page(width=612, height=792)
        page.insert_text((42, 36), "TRACE-MARK TRAINING DOCUMENT", fontsize=14)
        for index in range(lines):
            page.insert_text((42, 58 + index * 15), f"{index + 1:03d} {words} {words}", fontsize=8)
        document.save(path)


def generate_dataset(output_dir: str | Path, samples: int = 100, seed: int = 7) -> Path:
    output = Path(output_dir)
    images_dir = output / "images"
    images_dir.mkdir(parents=True, exist_ok=True)
    rng = random.Random(seed)
    manifest = output / "manifest.jsonl"
    with manifest.open("w", encoding="utf-8") as manifest_file:
        for index in range(samples):
            source = output / f"source-{index}.pdf"
            encoded = output / f"encoded-{index}.pdf"
            _source_pdf(source)
            payload = TracePayload(f"EXAM-{index:04d}", f"PRS-{index % 20:03d}", f"B{index:04d}", f"C{index % 1000:03d}", f"#{index:06d}")
            bits = encode_payload(payload)
            encode_pdf(source, encoded, bits, preview_path=output / f"preview-{index}.png")
            image = _augment(_render(encoded), rng)
            image_path = images_dir / f"sample-{index}.png"
            cv2.imwrite(str(image_path), image)
            manifest_file.write(json.dumps({"image": str(image_path), "bits": bits}) + "\n")
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="artifacts/training")
    parser.add_argument("--samples", type=int, default=100)
    args = parser.parse_args()
    print(generate_dataset(args.output, args.samples))


if __name__ == "__main__":
    main()