import type { GeneratedImage, AIMetadata } from './common';

/**
 * Background removal types.
 *
 * Prepares for ETAPA 43 — Background Removal integration.
 */

/**
 * Input for background removal operations.
 */
export interface BackgroundRemovalInput {
  /** Source image */
  image: import('./common').ImageInput;
}

/**
 * Result from background removal operations.
 */
export interface BackgroundRemovalResult {
  /** Image with background removed (transparent) */
  image: GeneratedImage;

  /** Optional: provider-specific metadata */
  metadata?: AIMetadata;
}
