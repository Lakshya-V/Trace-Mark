from pathlib import Path

import cv2


PATCH_SIZE = 224


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
    half_size = PATCH_SIZE // 2
    for index, (y, x, width, height) in enumerate(sorted(boxes)):
        center_x = x + width // 2
        center_y = y + height // 2
        left = max(0, center_x - half_size)
        top = max(0, center_y - half_size)
        right = min(image.shape[1], left + PATCH_SIZE)
        bottom = min(image.shape[0], top + PATCH_SIZE)
        left = max(0, right - PATCH_SIZE)
        top = max(0, bottom - PATCH_SIZE)
        patch = image[top:bottom, left:right]
        if patch.shape != (PATCH_SIZE, PATCH_SIZE):
            patch = cv2.copyMakeBorder(
                patch,
                0,
                PATCH_SIZE - patch.shape[0],
                0,
                PATCH_SIZE - patch.shape[1],
                cv2.BORDER_CONSTANT,
                value=255,
            )
        patch_path = output_path / f"patch_{index:06d}.png"
        if cv2.imwrite(str(patch_path), patch):
            patches.append(patch_path)

    return patches
