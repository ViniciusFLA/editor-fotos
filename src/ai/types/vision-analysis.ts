import type { BoundingBox, Confidence, AIMetadata } from './common';

/**
 * Vision / semantic analysis types.
 *
 * Prepares for ETAPA 44 — Logo Detection and ETAPA 45 — Desmontar Criativo.
 */

/**
 * A semantically labeled region detected in an image.
 */
export interface DetectedRegion {
  /** Unique identifier for this region */
  id: string;

  /** Bounding box in pixels relative to the original image */
  boundingBox: BoundingBox;

  /** Semantic label (e.g., 'headline', 'subheadline', 'cta', 'logo', 'product', 'person', 'background', 'price', 'badge') */
  label: string;

  /** Detection confidence (0-1) */
  confidence: Confidence;

  /** Optional: provider-specific metadata */
  metadata?: AIMetadata;
}

/**
 * High-level creative analysis describing detected components.
 */
export interface CreativeComposition {
  /** Regions classified as headlines */
  headlines: DetectedRegion[];

  /** Regions classified as subheadlines */
  subheadlines: DetectedRegion[];

  /** Regions classified as CTAs (call-to-action buttons) */
  ctas: DetectedRegion[];

  /** Regions classified as logos */
  logos: DetectedRegion[];

  /** Regions classified as products */
  products: DetectedRegion[];

  /** Regions classified as persons */
  persons: DetectedRegion[];

  /** Regions classified as price information */
  prices: DetectedRegion[];

  /** Regions classified as badges/promotions */
  badges: DetectedRegion[];

  /** Regions that didn't match a specific category */
  other: DetectedRegion[];

  /** Optional: provider-specific metadata */
  metadata?: AIMetadata;
}

/**
 * Input for vision analysis operations.
 */
export interface VisionAnalysisInput {
  /** Source image */
  image: import('./common').ImageInput;

  /** Optional: restrict analysis to specific categories */
  targetCategories?: string[];
}

/**
 * Result from vision analysis operations.
 */
export interface VisionAnalysisResult {
  /** Detected semantic composition of the creative */
  composition: CreativeComposition;

  /** All detected regions (flat list) */
  regions: DetectedRegion[];

  /** Optional: provider-specific metadata */
  metadata?: AIMetadata;
}
