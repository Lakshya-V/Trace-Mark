import fitz  # PyMuPDF
import hashlib
import random
import numpy as np
from typing import Dict, Any, List, Tuple
from ecc_engine import TraceMarkECC

class TraceMarkEncoder:
    """
    High-precision PDF physical steganography layout encoder.
    Embeds ECC-protected binary fingerprints into inter-word micro-spacing offsets
    while generating an explicit ground-truth embedding map for ML dataset extraction.
    """

    def __init__(self, shift_points: float = 0.25, seed: int = 1337, dpi: int = 144):
        self.shift_points = shift_points
        self.seed = seed
        self.dpi = dpi
        self.ecc = TraceMarkECC(ecc_symbols=16)

    def encode_pdf(
        self,
        input_pdf_path: str,
        output_pdf_path: str,
        metadata: Dict[str, Any]
    ) -> Dict[str, Any]:
        bitstream = self.ecc.encode_to_bitstream(metadata)
        payload_bit_len = len(bitstream)

        doc_orig = fitz.open(input_pdf_path)
        doc_enc = fitz.open(input_pdf_path)

        total_gaps_modified = 0
        pages_encoded = 0
        embedding_map = []

        prng = random.Random(self.seed)

        for page_num in range(len(doc_enc)):
            page = doc_enc[page_num]
            text_dict = page.get_text("rawdict")
            blocks = text_dict.get("blocks", [])

            lines_to_process = []
            page_gap_count = 0

            for b in blocks:
                if b.get("type") == 0:  # Text block
                    for line in b.get("lines", []):
                        line_words = []
                        for span in line.get("spans", []):
                            chars = span.get("chars", [])
                            if not chars:
                                continue

                            font_name = span.get("font", "helv")
                            if "+" in font_name:
                                font_name = font_name.split("+")[1]

                            font_size = span.get("size", 11)
                            font_color = fitz.sRGB_to_pdf(span.get("color", 0))

                            current_word_chars = []
                            current_origin = None

                            for c_info in chars:
                                char_str = c_info.get("c", "")
                                origin = c_info.get("origin", (0, 0))

                                if char_str == " ":
                                    if current_word_chars:
                                        line_words.append({
                                            "text": "".join(current_word_chars),
                                            "origin": current_origin,
                                            "font": font_name,
                                            "size": font_size,
                                            "color": font_color,
                                            "is_gap_after": True
                                        })
                                        current_word_chars = []
                                        current_origin = None
                                        page_gap_count += 1
                                else:
                                    if current_origin is None:
                                        current_origin = origin
                                    current_word_chars.append(char_str)

                            if current_word_chars:
                                line_words.append({
                                    "text": "".join(current_word_chars),
                                    "origin": current_origin,
                                    "font": font_name,
                                    "size": font_size,
                                    "color": font_color,
                                    "is_gap_after": False
                                })

                        if line_words:
                            lines_to_process.append((line.get("bbox"), line_words))

            if page_gap_count == 0:
                continue

            pages_encoded += 1

            gap_indices = list(range(page_gap_count))
            prng.shuffle(gap_indices)
            
            gap_bit_map = {}
            for idx, gap_id in enumerate(gap_indices):
                gap_bit_map[gap_id] = int(bitstream[idx % payload_bit_len])

            # Redact existing line text
            for line_bbox, _ in lines_to_process:
                page.add_redact_annot(fitz.Rect(line_bbox), fill=(1, 1, 1))
            page.apply_redactions()

            # Re-insert text with spacing modulation and record ground-truth coordinates
            global_gap_idx = 0

            for _, line_words in lines_to_process:
                accumulated_shift = 0.0

                for word in line_words:
                    orig_x, orig_y = word["origin"]
                    shifted_x = orig_x + accumulated_shift

                    page.insert_text(
                        fitz.Point(shifted_x, orig_y),
                        word["text"],
                        fontname=word["font"],
                        fontsize=word["size"],
                        color=word["color"],
                        overlay=True
                    )

                    if word["is_gap_after"]:
                        bit = gap_bit_map.get(global_gap_idx, 0)
                        shift = self.shift_points if bit == 1 else -self.shift_points

                        # Record exact gap ground truth for dataset generator
                        embedding_map.append({
                            "page": page_num,
                            "gap_index": global_gap_idx,
                            "bit": bit,
                            "shift": shift,
                            "x": round(shifted_x, 3),
                            "y": round(orig_y, 3),
                            "word": word["text"],
                            "font_size": word["size"]
                        })

                        accumulated_shift += shift
                        global_gap_idx += 1
                        total_gaps_modified += 1

        doc_enc.save(output_pdf_path, garbage=4, deflate=True)

        ssim_score, mse_score = self._compute_visual_quality(doc_orig, doc_enc)

        doc_orig.close()
        doc_enc.close()

        file_hash = self._compute_sha256(output_pdf_path)

        return {
            "input_path": input_pdf_path,
            "output_path": output_pdf_path,
            "sha256_hash": file_hash,
            "payload_bits": payload_bit_len,
            "ecc_parity_symbols": self.ecc.ecc_symbols,
            "embedding_locations": total_gaps_modified,
            "shift_points": self.shift_points,
            "pages_encoded": pages_encoded,
            "visual_quality": {
                "ssim": ssim_score,
                "mse": mse_score
            },
            "embedding_map": embedding_map  # Ground truth list for DL Dataset Generator
        }

# pdf_encoder.py (Replace _compute_visual_quality method)
    def _compute_visual_quality(self, doc_orig: fitz.Document, doc_enc: fitz.Document) -> Tuple[float, float]:
        if len(doc_orig) == 0:
            return 1.0, 0.0

        mat = fitz.Matrix(self.dpi / 72, self.dpi / 72)
        pix_a = doc_orig[0].get_pixmap(matrix=mat, colorspace=fitz.csGRAY)
        pix_b = doc_enc[0].get_pixmap(matrix=mat, colorspace=fitz.csGRAY)

        # Reshape to 2D matrices using exact pixmap dimensions
        img_a = np.frombuffer(pix_a.samples, dtype=np.uint8).reshape((pix_a.height, pix_a.width)).astype(np.float64)
        img_b = np.frombuffer(pix_b.samples, dtype=np.uint8).reshape((pix_b.height, pix_b.width)).astype(np.float64)

        # Align 2D dimensions
        min_h = min(img_a.shape[0], img_b.shape[0])
        min_w = min(img_a.shape[1], img_b.shape[1])
        img_a = img_a[:min_h, :min_w]
        img_b = img_b[:min_h, :min_w]

        mse = float(np.mean((img_a - img_b) ** 2))

        # 8x8 block-averaged SSIM
        block_size = 8
        ssims = []
        K1, K2, L = 0.01, 0.03, 255.0
        C1, C2 = (K1 * L) ** 2, (K2 * L) ** 2

        for r in range(0, min_h - block_size + 1, block_size):
            for c in range(0, min_w - block_size + 1, block_size):
                b1 = img_a[r:r+block_size, c:c+block_size]
                b2 = img_b[r:r+block_size, c:c+block_size]

                mu1, mu2 = np.mean(b1), np.mean(b2)
                var1, var2 = np.var(b1), np.var(b2)
                cov = np.mean((b1 - mu1) * (b2 - mu2))

                ssim_block = ((2 * mu1 * mu2 + C1) * (2 * cov + C2)) / ((mu1**2 + mu2**2 + C1) * (var1 + var2 + C2))
                ssims.append(ssim_block)

        ssim = float(np.mean(ssims)) if ssims else 1.0

        return round(ssim, 4), round(mse, 4)

    def _compute_sha256(self, filepath: str) -> str:
        sha256 = hashlib.sha256()
        with open(filepath, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                sha256.update(chunk)
        return sha256.hexdigest()