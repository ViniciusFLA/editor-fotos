import type { ImageElement } from '@/types';

/**
 * ETAPA 36.2B — single, testable image fit rule.
 *
 * The fit rule is applied exactly ONCE at import time (never during selection
 * or any subsequent sync), so an imported image's geometry is stable across
 * clicks.
 */

/** Maximum displayed size relative to the page (70%), used as the fit box. */
export const DEFAULT_MAX_DIMENSION_RATIO = 0.7;

export interface ComputeImageFitScaleInput {
  naturalWidth: number;
  naturalHeight: number;
  availableWidth: number;
  availableHeight: number;
  /** Never scale above this ratio (defaults to 1: no upscaling). */
  maxRatio?: number;
}

/**
 * Uniform, aspect-preserving fit scale.
 *
 * `scale = min(availableWidth / naturalWidth, availableHeight / naturalHeight, maxRatio)`
 *
 * A single scale is returned for both axes, so the aspect ratio is always
 * preserved. `maxRatio` prevents upscaling small images beyond 1×.
 */
export function computeImageFitScale(input: ComputeImageFitScaleInput): number {
  const {
    naturalWidth,
    naturalHeight,
    availableWidth,
    availableHeight,
    maxRatio = 1,
  } = input;

  if (naturalWidth <= 0 || naturalHeight <= 0) return maxRatio;
  if (availableWidth <= 0 || availableHeight <= 0) return maxRatio;

  const scaleX = availableWidth / naturalWidth;
  const scaleY = availableHeight / naturalHeight;

  return Math.min(scaleX, scaleY, maxRatio);
}

/** Geometry fields that a normal click must never mutate. */
export interface ImageGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  cropX: number;
  cropY: number;
  flipX: boolean;
  flipY: boolean;
}

/**
 * Snapshot the geometry of an image element (ETAPA 36.2B, FASE 11).
 *
 * Used by tests to assert the geometry invariant:
 *   geometry(after import) ≈ geometry(after click N).
 */
export function captureImageGeometry(image: ImageElement): ImageGeometry {
  return {
    x: image.x,
    y: image.y,
    width: image.width,
    height: image.height,
    scaleX: image.scaleX,
    scaleY: image.scaleY,
    rotation: image.rotation,
    cropX: image.cropX,
    cropY: image.cropY,
    flipX: image.flipX,
    flipY: image.flipY,
  };
}
