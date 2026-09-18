"""Deterministic OpenCV preprocessing for Trace-Mark page images."""

from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np


DEFAULT_SIZE = (256, 256)


def _order_points(points: np.ndarray) -> np.ndarray:
    ordered = np.zeros((4, 2), dtype=np.float32)
    sums = points.sum(axis=1)
    differences = np.diff(points, axis=1).ravel()
    ordered[0] = points[np.argmin(sums)]
    ordered[2] = points[np.argmax(sums)]
    ordered[1] = points[np.argmin(differences)]
    ordered[3] = points[np.argmax(differences)]
    return ordered


def detect_page_corners(image: np.ndarray) -> np.ndarray | None:
    """Detect the largest quadrilateral page contour, if one is visible."""

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if image.ndim == 3 else image
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 40, 140)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    image_area = float(gray.shape[0] * gray.shape[1])
    for contour in sorted(contours, key=cv2.contourArea, reverse=True):
        if cv2.contourArea(contour) < image_area * 0.25:
            continue
        polygon = cv2.approxPolyDP(contour, 0.03 * cv2.arcLength(contour, True), True)
        if len(polygon) == 4:
            return _order_points(polygon.reshape(4, 2).astype(np.float32))
    return None


def correct_perspective(image: np.ndarray, size: tuple[int, int] = DEFAULT_SIZE) -> np.ndarray:
    """Warp a detected page to a stable width/height, or resize if no page is found."""

    corners = detect_page_corners(image)
    if corners is None:
        return cv2.resize(image, size, interpolation=cv2.INTER_AREA)
    width, height = size
    target = np.array(
        [[0, 0], [width - 1, 0], [width - 1, height - 1], [0, height - 1]],
        dtype=np.float32,
    )
    transform = cv2.getPerspectiveTransform(corners, target)
    return cv2.warpPerspective(image, transform, size, borderValue=255)


def normalize_page(image: np.ndarray, size: tuple[int, int] = DEFAULT_SIZE) -> np.ndarray:
    """Return a grayscale, illumination-corrected uint8 page of ``size``."""

    page = correct_perspective(image, size)
    gray = cv2.cvtColor(page, cv2.COLOR_BGR2GRAY) if page.ndim == 3 else page
    background = cv2.GaussianBlur(gray, (0, 0), 21)
    corrected = cv2.divide(gray, background, scale=255)
    return cv2.normalize(corrected, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)


def load_and_preprocess(path: str | Path, size: tuple[int, int] = DEFAULT_SIZE) -> np.ndarray:
    """Read an image from disk and normalize it for model inference."""

    image = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError(f"unable to read image: {path}")
    return normalize_page(image, size)


def extract_fingerprint_regions(
    image: np.ndarray, size: tuple[int, int] = DEFAULT_SIZE
) -> list[np.ndarray]:
    """Return normalized fingerprint regions; currently the complete page is one region."""

    return [normalize_page(image, size)]