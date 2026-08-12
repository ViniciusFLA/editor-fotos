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

MAX_DIMENSION = 512


def _rss_mb() -> float:
    try:
        with open("/proc/self/status", "r") as f:
            for line in f:
                if line.startswith("VmRSS:"):
                    return round(int(line.split()[1]) / 1024, 1)
    except Exception:
        pass
    return -1.0


class OCREngine:
    def __init__(self):
        self._lock = threading.Lock()
        logger.info("Loading PP-OCRv5 latin models (mobile)...")
        self.ocr = PaddleOCR(
            text_detection_model_name="PP-OCRv5_mobile_det",
            text_recognition_model_name="latin_PP-OCRv5_mobile_rec",
            text_recognition_batch_size=1,
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
            device="cpu",
        )
        logger.info("PP-OCRv5 latin models loaded")

    def _shrink_memory(self):
        try:
            pipeline = getattr(self.ocr, "paddlex_pipeline", None)
            if pipeline is None:
                return
            seen = set()
            queue = [pipeline]
            while queue:
                obj = queue.pop()
                if id(obj) in seen:
                    continue
                seen.add(id(obj))
                predictor = getattr(obj, "predictor", None)
                if predictor is not None and hasattr(predictor, "try_shrink_memory"):
                    try:
                        predictor.try_shrink_memory()
                    except Exception:
                        pass
                for attr in ("text_det_model", "text_rec_model", "_pipeline", "paddlex_pipeline"):
                    child = getattr(obj, attr, None)
                    if child is not None and child is not pipeline:
                        queue.append(child)
        except Exception:
            pass

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

        h, w = img_bgr.shape[:2]
        scale = 1.0
        if max(h, w) > MAX_DIMENSION:
            scale = MAX_DIMENSION / max(h, w)
            new_w = int(w * scale)
            new_h = int(h * scale)
            img_bgr = cv2.resize(img_bgr, (new_w, new_h), interpolation=cv2.INTER_AREA)

        texts = []
        with self._lock:
            logger.info(f"[OCR] pre-predict RSS={_rss_mb()}MB (img {w}x{h} -> {img_bgr.shape[1]}x{img_bgr.shape[0]})")
            results = list(self.ocr.predict(img_bgr))
            logger.info(f"[OCR] post-predict RSS={_rss_mb()}MB, results={len(results)}")

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
                                "x": int(float(p[0]) / scale),
                                "y": int(float(p[1]) / scale),
                            })

                    bounding_box = None
                    if rec_boxes is not None and idx < len(rec_boxes):
                        box = rec_boxes[idx]
                        if len(box) >= 4:
                            x1 = int(float(box[0]) / scale)
                            y1 = int(float(box[1]) / scale)
                            x2 = int(float(box[2]) / scale)
                            y2 = int(float(box[3]) / scale)
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
        self._shrink_memory()

        return texts
