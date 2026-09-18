# Trace-Mark

Trace-Mark embeds a Reed-Solomon-protected provenance payload into PDF word spacing, then uses deterministic OpenCV preprocessing and a learned PyTorch decoder to recover it from page photographs.

## Backend

Install dependencies in the project environment:

```powershell
pip install -r requirements.txt
```

Start the API:

```powershell
uvicorn main:app --reload
```

`POST /api/v1/encode` accepts multipart form data with a JSON `metadata` field and `base_pdf`. `POST /api/v1/decode` accepts a JPEG or PNG photo. The decode response reports the predicted fingerprint, metadata, per-bit confidence summary, ECC/CRC validity, scan ID, and provenance lookup result.

## Train the decoder

Generate pages from Trace-Mark's own encoder. The generator creates known payloads and applies rotation, perspective, blur, lighting, shadow, noise, JPEG, and occlusion augmentations:

```powershell
python -m ml.dataset_generator --output artifacts/training --samples 100
python -m ml.train artifacts/training/manifest.jsonl --epochs 10 --checkpoint artifacts/models/trace-mark.pth
```

The training script uses `BCEWithLogitsLoss`, a train/validation split, bit accuracy, complete payload accuracy, and best-checkpoint saving. CUDA is used automatically when available; CPU is supported.

Set `TRACE_MARK_MODEL_PATH` when the checkpoint is stored elsewhere. To evaluate robustness after training:

```powershell
python -m ml.robustness artifacts/training/images/sample-0.png <ground-truth-bits> artifacts/models/trace-mark.pth
```

The report gives bit accuracy, complete payload recovery rate, and confidence for clean, rotated, perspective-distorted, blurred, shadowed, JPEG-compressed, noisy, and partially occluded variants. ECC recovery and invalid-fingerprint rates are enforced by the API's post-inference validation stage.