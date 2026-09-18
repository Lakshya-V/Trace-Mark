from pathlib import Path

import cv2


PATCH_SIZE = 128


def extract_patches(image_path: str | Path, output_dir: str | Path) -> list[Path]:
    """Extract deterministic square word-region patches from a full-page image."""
    image = cv2.imread(str(image_path), cv2.IMREAD_GRAYSCALE)
    if image is None:
        raise ValueError(f"Unable to read uploaded image: {image_path}")

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    threshold = cv2.adaptiveThreshold(
        cv2.GaussianBlur(image, (5, 5), 0),
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        31,
        11,
    )
    contours, _ = cv2.findContours(threshold, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    boxes = []
    for contour in contours:
        x, y, width, height = cv2.boundingRect(contour)
        if width >= 4 and height >= 4 and width * height >= 20:
            boxes.append((y, x, width, height))

    patches = []
    for index, (y, x, width, height) in enumerate(sorted(boxes)):
        margin_x = int(width * 1.5)
        margin_y = int(height * 0.5)
        start_x = max(0, x - margin_x)
        start_y = max(0, y - margin_y)
        end_x = min(image.shape[1], x + width + margin_x)
        end_y = min(image.shape[0], y + height + margin_y)
        patch = image[start_y:end_y, start_x:end_x]
        patch = cv2.resize(patch, (PATCH_SIZE, PATCH_SIZE), interpolation=cv2.INTER_AREA)
        patch_path = output_path / f"patch_{index:06d}.png"
        if cv2.imwrite(str(patch_path), patch):
            patches.append(patch_path)

    return patches
