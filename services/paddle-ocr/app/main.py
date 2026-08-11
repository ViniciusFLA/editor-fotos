"""
PaddleOCR FastAPI service for Creative Editor.

Uses PP-OCRv5 (latin model) supporting pt-BR, en, es.
Single model instance loaded at startup, reused across requests.
"""
import os
import time
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, File, UploadFile, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse
from .ocr_engine import OCREngine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("paddle-ocr")

OCR_SERVICE_TOKEN = os.environ.get("OCR_SERVICE_TOKEN", "")
security = HTTPBearer(auto_error=False)

engine: OCREngine | None = None
model_ready = False
startup_time: float | None = None


def verify_token(credentials: HTTPAuthorizationCredentials | None = Depends(security)):
    if not OCR_SERVICE_TOKEN:
        return
    if not credentials or credentials.credentials != OCR_SERVICE_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid or missing token")


@asynccontextmanager
async def lifespan(app: FastAPI):
    global engine, model_ready, startup_time
    start = time.time()
    logger.info("Loading PaddleOCR PP-OCRv5 (latin)...")
    try:
        engine = OCREngine()
        model_ready = True
        startup_time = time.time() - start
        logger.info(f"PaddleOCR loaded in {startup_time:.1f}s")
    except Exception as e:
        logger.error(f"Failed to load PaddleOCR: {e}")
        model_ready = False
    yield
    engine = None


app = FastAPI(
    title="PaddleOCR Service",
    version="1.0.0",
    lifespan=lifespan,
)

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_TYPES = {"image/png", "image/jpeg", "image/webp"}


@app.get("/health")
async def health():
    return {
        "status": "ok" if model_ready else "loading",
        "provider": "paddleocr",
        "model": "PP-OCRv5",
        "model_ready": model_ready,
        "startup_seconds": round(startup_time, 1) if startup_time else None,
        "languages": ["pt", "en", "es"],
    }


@app.post("/ocr", dependencies=[Depends(verify_token)])
async def ocr(file: UploadFile = File(...)):
    if not model_ready or engine is None:
        raise HTTPException(status_code=503, detail="OCR model not ready")

    if file.content_type and file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported media type: {file.content_type}. Allowed: png, jpeg, webp",
        )

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 10 MB)")

    try:
        results = engine.detect(contents)
        return JSONResponse(content={"detectedTexts": results})
    except Exception as e:
        logger.error(f"OCR failed: {e}")
        raise HTTPException(status_code=500, detail="OCR processing failed")
