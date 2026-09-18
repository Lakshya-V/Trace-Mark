"""Evaluate decoder robustness across simulated physical capture conditions."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2
import numpy as np
import torch

from dl.decoder import TraceMarkDecoder
from preprocessing import normalize_page


def _variants(image: np.ndarray) -> dict[str, np.ndarray]:
    height, width = image.shape[:2]
    rotation = cv2.warpAffine(image, cv2.getRotationMatrix2D((width / 2, height / 2), 4, 1), (width, height), borderValue=255)
    source = np.float32([[0, 0], [width, 0], [width, height], [0, height]])
    target = np.float32([[10, 8], [width - 8, 0], [width, height - 10], [0, height]])
    perspective = cv2.warpPerspective(image, cv2.getPerspectiveTransform(source, target), (width, height), borderValue=255)
    blurred = cv2.GaussianBlur(image, (7, 7), 1.8)
    shadowed = np.clip(image.astype(np.float32) * np.tile(np.linspace(0.65, 1.0, width), (height, 1)), 0, 255).astype(np.uint8)
    noisy = np.clip(image.astype(np.float32) + np.random.default_rng(9).normal(0, 7, image.shape), 0, 255).astype(np.uint8)
    ok, encoded = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, 35])
    compressed = cv2.imdecode(encoded, cv2.IMREAD_GRAYSCALE) if ok else image
    occluded = image.copy()
    occluded[height // 3 : height // 2, width // 4 : width // 2] = 255
    return {"clean": image, "rotated": rotation, "perspective": perspective, "blurred": blurred, "shadowed": shadowed, "jpeg": compressed, "noisy": noisy, "occluded": occluded}


def evaluate(image_path: str | Path, label_bits: str, checkpoint: str | Path) -> dict[str, dict[str, float]]:
    image = cv2.imread(str(image_path), cv2.IMREAD_GRAYSCALE)
    if image is None:
        raise FileNotFoundError(image_path)
    model = TraceMarkDecoder.load(checkpoint)
    report = {}
    for name, variant in _variants(image).items():
        normalized = normalize_page(variant)
        predictions, confidence = model.predict(torch.from_numpy(normalized))
        predicted = predictions[0]
        correct = sum(left == right for left, right in zip(predicted, label_bits))
        report[name] = {
            "bit_accuracy": correct / len(label_bits),
            "payload_recovered": float(predicted == label_bits),
            "mean_confidence": sum(confidence[0]) / len(confidence[0]),
        }
    return report


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("image")
    parser.add_argument("label_bits")
    parser.add_argument("checkpoint")
    args = parser.parse_args()
    print(json.dumps(evaluate(args.image, args.label_bits, args.checkpoint), indent=2))


if __name__ == "__main__":
    main()