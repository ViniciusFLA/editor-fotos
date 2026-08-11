import type { BoundingBox, Confidence, AIMetadata } from './common';

/**
 * Image segmentation and object detection types.
 *
 * Prepares for ETAPA 37 — Segmentation Provider integration.
 */

/**
 * Mask representation for segmentation results.
 *
 * Uses a discriminated union to support multiple mask formats
 * without coupling to Fabric.js or any specific image library.
 */

export interface BlobMask {
  kind: 'blob';
  /** Binary mask as a Blob (can be PNG, raw bytes, etc.) */
  data: Blob;
  mimeType: 'image/png' | 'application/octet-stream';
}

export interface DataUrlMask {
  kind: 'dataUrl';
  /** Mask as a data URL string */
  dataUrl: string;
}

export type AIMask = BlobMask | DataUrlMask;

/**
 * A single segmented object/region detected in an image.
 */
export interface SegmentedObject {
  /** Unique identifier for this segment within a result set */
  id: string;

  /** Bounding box in pixels relative to the original image */
  boundingBox: BoundingBox;

  /** Mask for this segmented object */
  mask: AIMask;

  /** Detection confidence (0-1) */
  confidence: Confidence;

  /** Optional: semantic label (e.g., 'person', 'product', 'logo', 'background') */
  label?: string;

  /** Optional: provider-specific metadata */
  metadata?: AIMetadata;
}

/**
 * Input for segmentation operations.
 */
export interface SegmentationInput {
  /** Source image */
  image: import('./common').ImageInput;

  /** Optional: point to trigger single-object segmentation (magic select) */
  clickPoint?: { x: number; y: number };

  /** Optional: restrict detection to specific labels */
  targetLabels?: string[];
}

/**
 * Result from segmentation operations.
 */
export interface SegmentationResult {
  /** All detected objects/regions */
  objects: SegmentedObject[];

  /** Optional: provider-specific metadata */
  metadata?: AIMetadata;
}
