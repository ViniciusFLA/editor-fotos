import type { GeneratedImage, AIMetadata } from './common';
import type { AIMask } from './segmentation';

/**
 * Inpainting types.
 *
 * Prepares for ETAPA 35 — Text Inpainting and ETAPA 40 — Object Inpainting.
 *
 * The same InpaintingProvider serves both use cases:
 * - Text inpainting: mask covers detected text regions
 * - Object inpainting: mask covers extracted objects
 */

/**
 * Input for inpainting operations.
 */
export interface InpaintingInput {
  /** Source image to reconstruct */
  image: import('./common').ImageInput;

  /** Region(s) to inpaint */
  mask: AIMask;
}

/**
 * Result from inpainting operations.
 */
export interface InpaintingResult {
  /** Reconstructed image with masked region(s) filled */
  image: GeneratedImage;

  /** Optional: provider-specific metadata */
  metadata?: AIMetadata;
}
