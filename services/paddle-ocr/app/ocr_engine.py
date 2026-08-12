"""
PaddleOCR engine wrapper for PP-OCRv5 (latin model).
Supports pt-BR, en, es with angle classification.
"""
import logging
import tempfile
import os
from paddleocr import PaddleOCR

logger = logging.getLogger("paddle-ocr")


class OCREngine:
    def __init__(self):
        logger.info("Initializing PaddleOCR without angle classification to reduce memory")
        self.ocr = PaddleOCR(lang="latin", use_angle_cls=False, use_gpu=False)

    def detect(self, image_bytes: bytes) -> list[dict]:
        """
        Run OCR on image bytes and return DetectedText-like results.

        Returns list of dicts with:
          - id, text, boundingBox, polygon, confidence, language
        """
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            tmp.write(image_bytes)
            tmp_path = tmp.name

        try:
            result = self.ocr.ocr(tmp_path)
        finally:
            os.unlink(tmp_path)

        if not result or not result[0]:
            return []

        texts = []
        for idx, line in enumerate(result[0]):
            if not line or len(line) < 2:
                continue

            box_points, (text, confidence) = line[0], line[1]

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
