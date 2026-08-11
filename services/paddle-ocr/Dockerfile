FROM python:3.11-slim

WORKDIR /app

# Install system deps for PaddleOCR
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download PaddleOCR models during build
RUN python -c "from paddleocr import PaddleOCR; ocr = PaddleOCR(lang='latin', use_angle_cls=True); del ocr"

COPY app/ ./app/

# Render provides PORT
EXPOSE 8000
CMD ["sh", "-c", "python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
