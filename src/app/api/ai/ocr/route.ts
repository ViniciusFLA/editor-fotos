import { NextResponse } from 'next/server';
import { GoogleOCRProvider } from '@/ai/providers/google-ocr-provider';
import { AIProviderError } from '@/ai/errors/ai-error';
import type { OCRInput } from '@/ai/types/ocr';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

function getProvider(): GoogleOCRProvider | null {
  const apiKey = process.env.OCR_API_KEY;
  if (!apiKey) return null;
  return new GoogleOCRProvider({ apiKey });
}

function errorResponse(code: string, message: string, status: number, retryable = false) {
  return NextResponse.json({ error: message, code, retryable }, { status });
}

export async function GET() {
  const configured = !!process.env.OCR_API_KEY;
  return NextResponse.json({
    configured,
    provider: configured ? 'google-cloud-vision' : null,
  });
}

export async function POST(request: Request) {
  const contentLength = parseInt(request.headers.get('content-length') ?? '0', 10);
  if (contentLength > MAX_FILE_SIZE) {
    return errorResponse('INVALID_INPUT', 'Request body too large', 400);
  }

  const contentType = (request.headers.get('content-type') ?? '').toLowerCase();

  let imageBase64: string;

  if (contentType.includes('multipart/form-data')) {
    try {
      const formData = await request.formData();
      const file = formData.get('file');

      if (!file || !(file instanceof File)) {
        return errorResponse('INVALID_INPUT', 'Missing file in multipart body', 400);
      }

      if (file.size > MAX_FILE_SIZE) {
        return errorResponse('INVALID_INPUT', 'File too large', 400);
      }

      const fileType = file.type;
      if (fileType && !ALLOWED_MIME_TYPES.includes(fileType)) {
        return errorResponse(
          'UNSUPPORTED_INPUT',
          `Unsupported image type: ${fileType}. Allowed: png, jpeg, webp`,
          415,
        );
      }

      const buffer = await file.arrayBuffer();
      imageBase64 = Buffer.from(buffer).toString('base64');
    } catch {
      return errorResponse('INVALID_INPUT', 'Failed to parse multipart body', 400);
    }
  } else {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return errorResponse('INVALID_INPUT', 'Invalid JSON body', 400);
    }

    const imageObj = body.image as Record<string, unknown> | undefined;
    const b64 =
      (typeof body.base64 === 'string' ? body.base64 : undefined) ??
      (typeof imageObj?.base64 === 'string' ? imageObj.base64 : undefined);

    if (typeof b64 !== 'string' || b64.length === 0) {
      return errorResponse(
        'INVALID_INPUT',
        'Missing image. Send as multipart/form-data (file field) or JSON with { image: { base64: "..." } }',
        400,
      );
    }

    imageBase64 = b64.replace(/^data:image\/\w+;base64,/, '');
  }

  if (imageBase64.length > MAX_FILE_SIZE * 1.4) {
    return errorResponse('INVALID_INPUT', 'Image too large after encoding', 400);
  }

  const provider = getProvider();
  if (!provider) {
    return errorResponse('AUTHENTICATION', 'OCR API key not configured', 503);
  }

  const input: OCRInput = {
    image: { base64: imageBase64 },
  };

  try {
    const result = await provider.detectText(input);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AIProviderError) {
      const statusMap: Record<string, number> = {
        AUTHENTICATION: 401,
        INVALID_INPUT: 400,
        UNSUPPORTED_INPUT: 415,
        RATE_LIMIT: 429,
        TIMEOUT: 504,
        NETWORK: 502,
        PROVIDER_ERROR: 502,
        INVALID_RESPONSE: 502,
        CANCELLED: 499,
        UNKNOWN: 500,
      };
      return errorResponse(
        error.code,
        error.message,
        statusMap[error.code] ?? 500,
        error.retryable,
      );
    }

    return errorResponse('UNKNOWN', 'Internal server error', 500);
  }
}
