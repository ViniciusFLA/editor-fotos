import type { OCRProvider, OCRProviderOptions } from '@/ai/providers/ocr-provider';
import type { OCRInput, OCRResult } from '@/ai/types/ocr';
import { AIProviderError, AIErrorCode } from '@/ai/errors/ai-error';

interface PaddleOCRProviderConfig {
  serviceUrl: string;
  token?: string;
  timeoutMs?: number;
}

/**
 * PaddleOCR Provider — delegates to a remote PP-OCRv5 service.
 *
 * The service must expose:
 *   POST /ocr  — accepts multipart/form-data with "file" field, returns JSON
 *   GET /health — returns { status, provider, model }
 *
 * Authentication: Bearer token via Authorization header (optional if token is set).
 */
export class PaddleOCRProvider implements OCRProvider {
  readonly id = 'paddleocr';
  readonly name = 'PaddleOCR (PP-OCRv5)';

  private readonly config: Required<Omit<PaddleOCRProviderConfig, 'token'>> & { token?: string };

  constructor(config: PaddleOCRProviderConfig) {
    if (!config.serviceUrl) {
      throw new AIProviderError(
        AIErrorCode.INVALID_INPUT,
        'PaddleOCR service URL is required',
        { provider: this.id },
      );
    }
    this.config = {
      serviceUrl: config.serviceUrl.replace(/\/$/, ''),
      timeoutMs: config.timeoutMs ?? 30000,
      token: config.token,
    };
  }

  async detectText(
    input: OCRInput,
    options?: OCRProviderOptions,
  ): Promise<OCRResult> {
    const imageBlob = await this.resolveImage(input);
    const formData = new FormData();
    formData.append('file', imageBlob, 'image.png');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

    if (options?.signal) {
      options.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    const headers: Record<string, string> = {};
    if (this.config.token) {
      headers['Authorization'] = `Bearer ${this.config.token}`;
    }

    try {
      const response = await fetch(`${this.config.serviceUrl}/ocr`, {
        method: 'POST',
        headers,
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        const status = response.status;

        if (status === 401 || status === 403) {
          throw new AIProviderError(AIErrorCode.AUTHENTICATION, `PaddleOCR auth failed: HTTP ${status}`, { provider: this.id });
        }
        throw new AIProviderError(AIErrorCode.PROVIDER_ERROR, `PaddleOCR error: HTTP ${status} — ${body.slice(0, 200)}`, { provider: this.id, retryable: status >= 500 });
      }

      const data = await response.json() as OCRResult;
      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (controller.signal.aborted) {
        if (options?.signal?.aborted) {
          throw new AIProviderError(AIErrorCode.CANCELLED, 'OCR operation cancelled', { provider: this.id, cause: error instanceof Error ? error : undefined });
        }
        throw new AIProviderError(AIErrorCode.TIMEOUT, 'PaddleOCR request timed out', { provider: this.id, retryable: true });
      }

      if (error instanceof AIProviderError) throw error;

      throw new AIProviderError(
        AIErrorCode.NETWORK,
        error instanceof Error ? error.message : 'Network error contacting PaddleOCR',
        { provider: this.id, retryable: true, cause: error instanceof Error ? error : undefined },
      );
    }
  }

  private async resolveImage(input: OCRInput): Promise<Blob> {
    const { image } = input;

    if (image.blob) return image.blob;

    if (image.base64) {
      const clean = image.base64.replace(/^data:image\/\w+;base64,/, '');
      const bytes = Uint8Array.from(atob(clean), (c) => c.charCodeAt(0));
      return new Blob([bytes], { type: 'image/png' });
    }

    if (image.url) {
      const resp = await fetch(image.url);
      if (!resp.ok) throw new AIProviderError(AIErrorCode.INVALID_INPUT, `Failed to fetch image URL: ${resp.status}`, { provider: this.id });
      return await resp.blob();
    }

    throw new AIProviderError(AIErrorCode.INVALID_INPUT, 'No image source provided', { provider: this.id });
  }
}
