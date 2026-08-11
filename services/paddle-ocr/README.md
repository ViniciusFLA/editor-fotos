# PaddleOCR Service (PP-OCRv5)

OCR microservice for the Creative Editor.
Deployed on Render Free tier.

## Architecture

```
POST /ocr  (auth required)  →  PaddleOCR PP-OCRv5  →  DetectedText[]
GET  /health                 →  { status, provider, model }
```

## Local Development

```bash
cd services/paddle-ocr
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt

# First run downloads models (~150 MB, one-time)
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Deploy to Render

### 1. Create Web Service

- **Name:** `editor-fotos-paddle-ocr`
- **Runtime:** Docker
- **Root Directory:** `services/paddle-ocr`
- **Instance Type:** Free
- **Region:** Oregon (US West) or Frankfurt (EU)

### 2. Environment Variables

| Variable | Description |
|----------|-------------|
| `OCR_SERVICE_TOKEN` | Bearer token for POST /ocr auth (required) |

### 3. Health Check

- **Path:** `/health`
- **Expected:** HTTP 200 with `{ "status": "ok" }`

### 4. Build & Deploy

1. Connect GitHub repo or upload Dockerfile
2. Render auto-builds from `services/paddle-ocr/Dockerfile`
3. First build downloads PaddleOCR models (~150 MB)
4. Cold start: ~60-90s (model loading)
5. Warm requests: ~2-5s per image

### 5. Service URL

After deploy, the Render dashboard shows the service URL, e.g.:
`https://editor-fotos-paddle-ocr.onrender.com`

## API Reference

### GET /health

```json
{
  "status": "ok",
  "provider": "paddleocr",
  "model": "PP-OCRv5",
  "model_ready": true,
  "startup_seconds": 45.3,
  "languages": ["pt", "en", "es"]
}
```

### POST /ocr

Headers: `Authorization: Bearer <OCR_SERVICE_TOKEN>`

Body: `multipart/form-data` with `file` field (PNG/JPEG/WEBP, max 10 MB)

Response:
```json
{
  "detectedTexts": [
    {
      "id": "paddle-0",
      "text": "PROMOÇÃO DA SEMANA",
      "boundingBox": { "x": 50, "y": 80, "width": 700, "height": 60 },
      "polygon": [{ "x": 50, "y": 80 }, ...],
      "confidence": 0.9876,
      "language": "latin"
    }
  ]
}
```

## Model

- **PP-OCRv5** (latin model)
- Languages: pt-BR, English, Español
- Angle classification: enabled
- Coordinates: pixels relative to original image

## Limitations

- **Render Free:** 512 MB RAM, CPU only, spins down after 15min inactivity
- **Cold start:** ~60-90s on first request after inactivity
- **Concurrency:** Single request at a time (Free tier)
- **Max image:** 10 MB
- **Supported formats:** PNG, JPEG, WEBP

## Security

- POST /ocr requires `Authorization: Bearer` header
- Token configured via `OCR_SERVICE_TOKEN` env var
- GET /health is public (useful for Render health checks)
