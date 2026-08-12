"""
PaddleOCR engine wrapper for PP-OCRv5 (latin model).
Supports pt-BR, en, es with angle classification.
"""
import logging
import numpy as np
from PIL import Image
import io
from paddleocr import PaddleOCR

logger = logging.getLogger("paddle-ocr")

MAX_DIMENSION = 1600


class OCREngine:
    def __init__(self):
        self.ocr = PaddleOCR(lang="latin", use_angle_cls=True)

    def detect(self, image_bytes: bytes) -> list[dict]:
        """
        Run OCR on image bytes and return DetectedText-like results.

        Returns list of dicts with:
          - id, text, boundingBox, polygon, confidence, language
        """
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

        original_w, original_h = image.size
        scale = 1.0

        if max(original_w, original_h) > MAX_DIMENSION:
            scale = MAX_DIMENSION / max(original_w, original_h)
            new_w = int(original_w * scale)
            new_h = int(original_h * scale)
            image = image.resize((new_w, new_h), Image.LANCZOS)

        image_np = np.array(image)[:, :, ::-1].copy()

        result = self.ocr.ocr(image_np, cls=True)

        if not result or not result[0]:
            return []

        texts = []
        for idx, line in enumerate(result[0]):
            if not line or len(line) < 2:
                continue

            box_points, (text, confidence) = line[0], line[1]

            if scale != 1.0:
                box_points = [[p[0] / scale, p[1] / scale] for p in box_points]

            xs = [p[0] for p in box_points]
            ys = [p[1] for p in box_points]

            texts.append({
                "id": f"paddle-{idx}",
                "text": text,
                "boundingBox": {
                    "x": int(min(xs)),
                    "y": int(min(ys)),
                    "width": int(max(xs) - min(xs)),
                    "height": int(max(ys) - min(ys)),
                },
                "polygon": [
                    {"x": int(p[0]), "y": int(p[1])} for p in box_points
                ],
                "confidence": round(float(confidence), 4) if confidence else None,
                "language": "latin",
            })

        return texts
