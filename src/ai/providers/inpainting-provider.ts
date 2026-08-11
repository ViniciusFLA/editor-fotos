import type { InpaintingInput, InpaintingResult } from '@/ai/types/inpainting';

/**
 * Inpainting Provider interface.
 *
 * Responsibility: reconstruct masked regions of an image.
 *
 * The same provider serves both text inpainting (ETAPA 35)
 * and object inpainting (ETAPA 40).
 *
 * All coordinates are in PIXELS relative to the original image.
 * Does NOT depend on Fabric.js or any specific vendor SDK.
 */
export interface InpaintingProvider {
  /** Stable identifier for this provider */
  readonly id: string;

  /** Human-readable provider name */
  readonly name: string;

  /**
   * Fill/reconstruct masked regions of an image.
   *
   * @param input - Source image and mask identifying regions to fill
   * @param options.signal - AbortSignal for cancellation
   * @returns Reconstructed image
   * @throws AIProviderError on failure
   */
  inpaint(
    input: InpaintingInput,
    options?: InpaintingProviderOptions,
  ): Promise<InpaintingResult>;
}

export interface InpaintingProviderOptions {
  /** Signal to cancel the operation */
  signal?: AbortSignal;
}
