import type { BackgroundRemovalInput, BackgroundRemovalResult } from '@/ai/types/background-removal';

/**
 * Background Removal Provider interface.
 *
 * Responsibility: remove the background from an image, producing a
 * transparent version.
 *
 * Prepares for ETAPA 43 — Background Removal integration.
 *
 * Does NOT depend on Fabric.js or any specific vendor SDK.
 */
export interface BackgroundRemovalProvider {
  /** Stable identifier for this provider */
  readonly id: string;

  /** Human-readable provider name */
  readonly name: string;

  /**
   * Remove the background from an image.
   *
   * @param input - Source image
   * @param options.signal - AbortSignal for cancellation
   * @returns Image with transparent background
   * @throws AIProviderError on failure
   */
  removeBackground(
    input: BackgroundRemovalInput,
    options?: BackgroundRemovalProviderOptions,
  ): Promise<BackgroundRemovalResult>;
}

export interface BackgroundRemovalProviderOptions {
  /** Signal to cancel the operation */
  signal?: AbortSignal;
}
