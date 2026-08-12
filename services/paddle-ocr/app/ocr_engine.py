"""
PaddleOCR engine wrapper for PP-OCRv5 (latin model).
Supports pt-BR, en, es with accent preservation.
"""
import gc
import logging
import threading
import numpy as np
import cv2
from paddleocr import PaddleOCR

logger = logging.getLogger("paddle-ocr")


class OCREngine:
    def __init__(self):
        self._lock = threading.Lock()
        logger.info("Loading PP-OCRv5 latin models (mobile)...")
        self.ocr = PaddleOCR(
            text_detection_model_name="PP-OCRv5_mobile_det",
            text_recognition_model_name="latin_PP-OCRv5_mobile_rec",
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
            device="cpu",
        )
        logger.info("PP-OCRv5 latin models loaded")

    def detect(self, image_bytes: bytes) -> list[dict]:
        """
        Run OCR on image bytes and return DetectedText-like results.

        Returns list of dicts with:
          - id, text, boundingBox, polygon, confidence, language
        """
        nparr = np.frombuffer(image_bytes, np.uint8)
        img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img_bgr is None:
            raise ValueError("Failed to decode image")

        texts = []
        with self._lock:
            results = list(self.ocr.predict(img_bgr))

            for res in results:
                rec_texts = res.get("rec_texts")
                rec_scores = res.get("rec_scores")
                rec_polys = res.get("rec_polys")
                rec_boxes = res.get("rec_boxes")

                if rec_texts is None:
                    continue

                for idx, raw in enumerate(rec_texts):
                    confidence = None
                    if isinstance(raw, (tuple, list)) and len(raw) > 0:
                        text = raw[0]
                        if len(raw) > 1:
                            confidence = raw[1]
                    else:
                        text = raw

                    text = str(text) if text is not None else ""
                    if not text.strip():
                        continue

                    if confidence is None and rec_scores is not None and idx < len(rec_scores):
                        confidence = rec_scores[idx]

                    polygon = []
                    if rec_polys is not None and idx < len(rec_polys):
                        for p in rec_polys[idx]:
                            polygon.append({
                                "x": int(float(p[0])),
                                "y": int(float(p[1])),
                            })

                    bounding_box = None
                    if rec_boxes is not None and idx < len(rec_boxes):
                        box = rec_boxes[idx]
                        if len(box) >= 4:
                            x1, y1, x2, y2 = (int(float(v)) for v in box[:4])
                            bounding_box = {
                                "x": x1,
                                "y": y1,
                                "width": max(0, x2 - x1),
                                "height": max(0, y2 - y1),
                            }
                    if bounding_box is None and polygon:
                        xs = [p["x"] for p in polygon]
                        ys = [p["y"] for p in polygon]
                        bounding_box = {
                            "x": int(min(xs)),
                            "y": int(min(ys)),
                            "width": int(max(xs) - min(xs)),
                            "height": int(max(ys) - min(ys)),
                        }

                    texts.append({
                        "id": f"paddle-{idx}",
                        "text": str(text),
                        "boundingBox": bounding_box,
                        "polygon": polygon,
                        "confidence": round(float(confidence), 4) if confidence is not None else None,
                        "language": "latin",
                    })

        del img_bgr, nparr, results
        gc.collect()

        return texts
