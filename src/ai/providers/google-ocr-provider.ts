import type { OCRProvider, OCRProviderOptions } from '@/ai/providers/ocr-provider';
import type { OCRInput, OCRResult } from '@/ai/types/ocr';
import { AIProviderError, AIErrorCode } from '@/ai/errors/ai-error';
import { normalizeGoogleOCRResponse } from '@/ai/normalizers/ocr-normalizer';

const GOOGLE_VISION_API = 'https://vision.googleapis.com/v1/images:annotate';
const DEFAULT_TIMEOUT_MS = 30000;
const URL_FETCH_MAX_REDIRECTS = 3;
const URL_FETCH_MAX_SIZE = 10 * 1024 * 1024; // 10 MB

const BLOCKED_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '[::1]',
  'metadata.google.internal',
  '169.254.169.254',
]);

const BLOCKED_IP_PREFIXES: RegExp[] = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
];

function isBlockedHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(lower)) return true;
  if (lower.startsWith('[') && lower.endsWith(']')) {
    const inner = lower.slice(1, -1);
    if (inner === '::1' || inner === '0:0:0:0:0:0:0:1' || inner.startsWith('fe80:')) return true;
    return false;
  }
  return BLOCKED_IP_PREFIXES.some((re) => re.test(lower));
}

function validateImageUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new AIProviderError(AIErrorCode.INVALID_INPUT, 'Invalid URL format', { provider: 'google-cloud-vision' });
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new AIProviderError(AIErrorCode.INVALID_INPUT, 'Only http/https URLs are supported', { provider: 'google-cloud-vision' });
  }
  if (isBlockedHost(url.hostname)) {
    throw new AIProviderError(AIErrorCode.INVALID_INPUT, 'URL hostname is not allowed', { provider: 'google-cloud-vision' });
  }
  return url;
}

interface GoogleOCRProviderConfig {
  apiKey: string;
  timeoutMs?: number;
}

/**
 * Google Cloud Vision OCR Provider.
 *
 * Uses the REST API (no SDK dependency) for Vercel serverless compatibility.
 * API Key must be stored server-side (never exposed to client).
 *
 * @example
 *   const provider = new GoogleOCRProvider({ apiKey: process.env.OCR_API_KEY! });
 *   const result = await provider.detectText(input);
 */
export class GoogleOCRProvider implements OCRProvider {
  readonly id = 'google-cloud-vision';
  readonly name = 'Google Cloud Vision OCR';

  private readonly config: Required<GoogleOCRProviderConfig>;

  constructor(config: GoogleOCRProviderConfig) {
    if (!config.apiKey) {
      throw new AIProviderError(
        AIErrorCode.AUTHENTICATION,
        'Google Cloud Vision API key is required',
        { provider: this.id },
      );
    }
    this.config = {
      apiKey: config.apiKey,
      timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    };
  }

  async detectText(
    input: OCRInput,
    options?: OCRProviderOptions,
  ): Promise<OCRResult> {
    const imageContent = await this.resolveImageContent(input);
    const requestBody = {
      requests: [
        {
          image: { content: imageContent },
          features: [
            {
              type: 'TEXT_DETECTION',
              maxResults: 100,
            },
          ],
          imageContext: input.language
            ? { languageHints: [input.language] }
            : { languageHints: ['pt', 'en', 'es'] },
        },
      ],
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.config.timeoutMs,
    );

    if (options?.signal) {
      options.signal.addEventListener(
        'abort',
        () => controller.abort(),
        { once: true },
      );
    }

    try {
      const response = await fetch(
        `${GOOGLE_VISION_API}?key=${this.config.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        },
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        await this.handleHttpError(response);
      }

      const data = await response.json();

      return normalizeGoogleOCRResponse(
        data,
        // We don't have image dimensions at this level — Google works
        // with the actual image, so coordinates are already in pixels
        // of the submitted image.
        Number.MAX_SAFE_INTEGER,
        Number.MAX_SAFE_INTEGER,
      );
    } catch (error) {
      clearTimeout(timeoutId);

      if (controller.signal.aborted) {
        if (options?.signal?.aborted) {
          throw new AIProviderError(
            AIErrorCode.CANCELLED,
            'OCR operation cancelled',
            { provider: this.id, cause: error instanceof Error ? error : undefined },
          );
        }
        throw new AIProviderError(
          AIErrorCode.TIMEOUT,
          `OCR operation timed out after ${this.config.timeoutMs}ms`,
          { provider: this.id, retryable: true },
        );
      }

      if (error instanceof AIProviderError) throw error;

      throw new AIProviderError(
        AIErrorCode.NETWORK,
        error instanceof Error ? error.message : 'Network error during OCR',
        { provider: this.id, retryable: true, cause: error instanceof Error ? error : undefined },
      );
    }
  }

  private async resolveImageContent(input: OCRInput): Promise<string> {
    const { image } = input;

    if (image.base64) {
      return image.base64.replace(/^data:image\/\w+;base64,/, '');
    }

    if (image.url) {
      const validatedUrl = validateImageUrl(image.url);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const resp = await fetch(validatedUrl.href, {
          signal: controller.signal,
          redirect: 'manual',
        });

        clearTimeout(timeoutId);

        if (resp.status >= 300 && resp.status < 400) {
          let redirectCount = 0;
          let location = resp.headers.get('location');
          let currentUrl = validatedUrl;

          while (location && redirectCount < URL_FETCH_MAX_REDIRECTS) {
            const redirectUrl = new URL(location, currentUrl);
            validateImageUrl(redirectUrl.href);
            currentUrl = redirectUrl;
            redirectCount++;

            const redirectResp = await fetch(redirectUrl.href, { signal: controller.signal });
            if (redirectResp.ok) {
              const redirectType = redirectResp.headers.get('content-type') ?? '';
              if (!redirectType.startsWith('image/')) {
                throw new AIProviderError(
                  AIErrorCode.INVALID_INPUT,
                  `URL does not point to an image (${redirectType})`,
                  { provider: this.id },
                );
              }
              const contentLength = parseInt(redirectResp.headers.get('content-length') ?? '0', 10);
              if (contentLength > URL_FETCH_MAX_SIZE) {
                throw new AIProviderError(
                  AIErrorCode.INVALID_INPUT,
                  'Image exceeds maximum download size',
                  { provider: this.id },
                );
              }
              const buffer = await redirectResp.arrayBuffer();
              return Buffer.from(buffer).toString('base64');
            }
            location = redirectResp.headers.get('location');
            clearTimeout(timeoutId);
          }

          throw new AIProviderError(
            AIErrorCode.INVALID_INPUT,
            redirectCount >= URL_FETCH_MAX_REDIRECTS ? 'Too many redirects' : 'Invalid redirect chain',
            { provider: this.id },
          );
        }

        if (!resp.ok) {
          throw new AIProviderError(
            AIErrorCode.INVALID_INPUT,
            `Failed to fetch image URL: ${resp.status}`,
            { provider: this.id },
          );
        }

        const contentType = resp.headers.get('content-type') ?? '';
        if (!contentType.startsWith('image/')) {
          throw new AIProviderError(
            AIErrorCode.INVALID_INPUT,
            `URL does not point to an image (${contentType})`,
            { provider: this.id },
          );
        }

        const contentLength = parseInt(resp.headers.get('content-length') ?? '0', 10);
        if (contentLength > URL_FETCH_MAX_SIZE) {
          throw new AIProviderError(
            AIErrorCode.INVALID_INPUT,
            'Image exceeds maximum download size',
            { provider: this.id },
          );
        }

        const buffer = await resp.arrayBuffer();
        return Buffer.from(buffer).toString('base64');
      } catch (err) {
        clearTimeout(timeoutId);
        if (controller.signal.aborted) {
          throw new AIProviderError(
            AIErrorCode.TIMEOUT,
            'Image URL download timed out',
            { provider: this.id, retryable: true },
          );
        }
        if (err instanceof AIProviderError) throw err;
        throw new AIProviderError(
          AIErrorCode.INVALID_INPUT,
          `Failed to load image from URL: ${err instanceof Error ? err.message : 'unknown error'}`,
          { provider: this.id },
        );
      }
    }

    if (image.blob) {
      const buffer = await image.blob.arrayBuffer();
      return Buffer.from(buffer).toString('base64');
    }

    throw new AIProviderError(
      AIErrorCode.INVALID_INPUT,
      'No image source provided (blob, url, or base64)',
      { provider: this.id },
    );
  }

  private async handleHttpError(response: Response): Promise<never> {
    const status = response.status;

    if (status === 401 || status === 403) {
      throw new AIProviderError(
        AIErrorCode.AUTHENTICATION,
        'Google Cloud Vision authentication failed — check API key',
        { provider: this.id },
      );
    }

    if (status === 429) {
      throw new AIProviderError(
        AIErrorCode.RATE_LIMIT,
        'Google Cloud Vision rate limit exceeded',
        { provider: this.id, retryable: true },
      );
    }

    throw new AIProviderError(
      AIErrorCode.PROVIDER_ERROR,
      `Google Cloud Vision returned HTTP ${status}`,
      { provider: this.id, retryable: status >= 500 },
    );
  }
}
