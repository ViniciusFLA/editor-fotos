import type { OCRInput, OCRResult } from '@/ai/types/ocr';

/**
 * OCR Provider interface.
 *
 * Responsibility: detect and recognize text in images.
 *
 * All coordinates are in PIXELS relative to the original image.
 * Does NOT depend on Fabric.js or any specific vendor SDK.
 *
 * Prepares for ETAPA 32 — OCR Provider integration.
 */
export interface OCRProvider {
  /** Stable identifier for this provider */
  readonly id: string;

  /** Human-readable provider name */
  readonly name: string;

  /**
   * Detect and recognize text in an image.
   *
   * @param input - Image and optional parameters
   * @param options.signal - AbortSignal for cancellation
   * @returns Detected text regions with bounding boxes and confidence
   * @throws AIProviderError on failure
   */
  detectText(
    input: OCRInput,
    options?: OCRProviderOptions,
  ): Promise<OCRResult>;
}

export interface OCRProviderOptions {
  /** Signal to cancel the operation */
  signal?: AbortSignal;
}
