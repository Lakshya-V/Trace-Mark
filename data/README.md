# Trace-Mark Physical Steganography Dataset

## Project Overview

Trace-Mark is a physical-document provenance and leak-forensics system.

The system embeds a binary fingerprint into printed-document typography using subtle word-spacing modifications. A computer-vision model is used to detect the hidden binary signal from document images, after which error correction and checksum verification recover the embedded provenance information.

The provenance payload can represent:

- Exam ID
- Press ID
- Batch ID
- Center ID
- Copy ID

---

# Dataset Contents

This dataset contains two complementary data resources.

## 1. Synthetic Trace-Mark Training Dataset

The synthetic dataset is used for training the deep-learning decoder.

### Size

- 10 uniquely encoded documents
- 1,500 embedding locations per document
- 15,000 total labeled image patches
- Patch size: 128 × 128 pixels
- Image type: grayscale PNG
- Task: binary classification

Each patch represents a location containing an embedded Trace-Mark binary signal.

### Labels

`labels.csv` contains the ground-truth information for every patch.

Important fields include:

- `filename`
- `document`
- `page`
- `gap_index`
- `bit`
- `shift`
- `word`

The `bit` field is the machine-learning target:

- `0` = Trace-Mark bit 0
- `1` = Trace-Mark bit 1

### Class Distribution

- Bit 0: 10,388 samples
- Bit 1: 4,612 samples

The class imbalance is preserved from the generated Trace-Mark payload distribution.

---

# 2. Real-Document Imaging Condition Dataset

A second dataset was generated from 15 real examination-paper documents.

The purpose of this dataset is to characterize document appearance and imaging conditions encountered when a physical examination paper is photographed or scanned.

### Size

- 15 real examination-paper documents
- 25 document pages
- 250 generated condition images
- 10 conditions per page

### Imaging Conditions

The generated conditions include:

- Normal
- Low light
- Bright light
- Uneven lighting
- Shadow
- Blur
- Perspective distortion
- Sensor noise
- JPEG compression
- Combined degradation

`conditions.csv` records the document, page and imaging condition corresponding to each image.

### Important Note

The real-document condition images are not Trace-Mark bit-labeled samples.

They are used as a real-document robustness/reference set for studying realistic document-imaging conditions.

---

# Directory Structure

```text
Trace-Mark Dataset/
│
├── patches/
│   ├── 000000.png
│   ├── 000001.png
│   └── ...
│
├── labels.csv
│
├── encoded_documents/
│   ├── DOC001.pdf
│   ├── DOC002.pdf
│   └── ...
│
├── ground_truth/
│   ├── DOC001_map.json
│   ├── DOC002_map.json
│   └── ...
│
└── real_document_conditions/
    ├── images/
    │   ├── <paper folders>
    │   └── ...
    │
    └── conditions.csv