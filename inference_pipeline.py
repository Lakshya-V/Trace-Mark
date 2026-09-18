from pathlib import Path
from typing import Any, Dict

import torch
from PIL import Image
from torchvision.models import resnet18
from torchvision.transforms import v2


_robust_model = Path(__file__).resolve().parent / "models" / "trace_mark_resnet18_robust.pth"
_standard_model = Path(__file__).resolve().parent / "models" / "trace_mark_resnet18.pth"
DEFAULT_MODEL_PATH = _robust_model if _robust_model.exists() else _standard_model


class TraceMarkDetector:
    """Load the Trace-Mark classifier and predict one patch at a time."""

    def __init__(self, model_path: str | Path = DEFAULT_MODEL_PATH):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = resnet18(weights=None)
        self.model.fc = torch.nn.Linear(self.model.fc.in_features, 2)

        checkpoint = torch.load(model_path, map_location=self.device, weights_only=True)
        self.model.load_state_dict(checkpoint)
        self.model.to(self.device)
        self.model.eval()

        self.transform = v2.Compose([
            v2.ToImage(),
            v2.ToDtype(torch.float32, scale=True),
            v2.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])

    def predict_patch(self, image_path: str | Path) -> Dict[str, Any]:
        """Return the predicted bit, shift direction, shift value, and confidence."""
        image = Image.open(image_path).convert("RGB")
        tensor = self.transform(image).unsqueeze(0).to(self.device)

        with torch.inference_mode():
            probabilities = torch.softmax(self.model(tensor), dim=1)[0]

        bit = int(torch.argmax(probabilities).item())
        return {
            "bit": bit,
            "shift": "right" if bit else "left",
            "shift_points": 0.12 if bit else -0.12,
            "confidence": float(probabilities[bit].item()),
            "probabilities": [float(value) for value in probabilities.cpu()],
        }


def infer_trace_bits(image_path: Path, detector: TraceMarkDetector) -> Dict[str, Any]:
    """Compatibility wrapper for the existing decode route."""
    return detector.predict_patch(image_path)