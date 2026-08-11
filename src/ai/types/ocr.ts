import type { BoundingBox, Confidence, AIMetadata } from './common';

/**
 * OCR (Optical Character Recognition) types.
 *
 * Prepares for ETAPA 32 — OCR Provider integration.
 */

/**
 * A single detected text region in an image.
 */
export interface DetectedText {
  /** Unique identifier for this detection within a result set */
  id: string;

  /** The recognized text content */
  text: string;

  /** Bounding box in pixels relative to the original image */
  boundingBox: BoundingBox;

  /** Detection confidence (0-1). Undefined when the provider does not supply it. */
  confidence?: Confidence;

  /** Optional: polygon representation of the text region (clockwise) */
  polygon?: Array<{ x: number; y: number }>;

  /** Optional: detected language (e.g., 'pt', 'en', 'es') */
  language?: string;

  /** Optional: approximated font size in pixels of the original image */
  approximateFontSize?: number;

  /** Optional: approximated text color as hex string */
  approximateColor?: string;

  /** Optional: approximated text alignment */
  approximateAlignment?: 'left' | 'center' | 'right';

  /** Optional: provider-specific metadata */
  metadata?: AIMetadata;
}

/**
 * Input for OCR operations.
 */
export interface OCRInput {
  /** Source image */
  image: import('./common').ImageInput;

  /** Optional: language hint (ISO 639-1 code) */
  language?: string;

  /** Optional: restrict detection to specific regions */
  regionsOfInterest?: BoundingBox[];
}

/**
 * Result from OCR operations.
 */
export interface OCRResult {
  /** All detected text regions */
  detectedTexts: DetectedText[];

  /** Optional: provider-specific metadata */
  metadata?: AIMetadata;
}
