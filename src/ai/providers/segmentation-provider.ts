import type { SegmentationInput, SegmentationResult } from '@/ai/types/segmentation';

/**
 * Segmentation Provider interface.
 *
 * Responsibility: identify and segment objects/regions in images.
 *
 * All coordinates are in PIXELS relative to the original image.
 * Does NOT depend on Fabric.js or any specific vendor SDK.
 *
 * Prepares for ETAPA 37 — Segmentation Provider integration.
 */
export interface SegmentationProvider {
  /** Stable identifier for this provider */
  readonly id: string;

  /** Human-readable provider name */
  readonly name: string;

  /**
   * Segment objects/regions in an image.
   *
   * @param input - Image and optional parameters
   * @param options.signal - AbortSignal for cancellation
   * @returns Segmented objects with masks, bounding boxes, and confidence
   * @throws AIProviderError on failure
   */
  segment(
    input: SegmentationInput,
    options?: SegmentationProviderOptions,
  ): Promise<SegmentationResult>;
}

export interface SegmentationProviderOptions {
  /** Signal to cancel the operation */
  signal?: AbortSignal;
}
