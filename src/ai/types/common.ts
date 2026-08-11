import { z } from 'zod';

/**
 * Bounding box in PIXELS relative to the original image (not canvas/viewport).
 *
 * All AI providers return coordinates in this canonical system.
 * Conversion to canvas/Fabric coordinates belongs to a later layer.
 *
 * Example: for a 1080x1080 original image:
 *   { x: 100, y: 200, width: 400, height: 80 }
 * means a rectangle starting at pixel (100, 200) in the source image.
 */
export const BoundingBoxSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().positive().finite(),
  height: z.number().positive().finite(),
});

export type BoundingBox = z.infer<typeof BoundingBoxSchema>;

/**
 * Confidence value from AI providers.
 * Always a number between 0 and 1 (inclusive).
 * Formatting for display belongs to the UI layer.
 */
export const ConfidenceSchema = z.number().min(0).max(1);

export type Confidence = z.infer<typeof ConfidenceSchema>;

/**
 * Supported MIME types for image input/output.
 */
export const ImageMimeTypeSchema = z.enum(['image/png', 'image/jpeg', 'image/webp']);

export type ImageMimeType = z.infer<typeof ImageMimeTypeSchema>;

/**
 * Image input for AI providers.
 *
 * Supports multiple sources without coupling to Fabric.js.
 * At least one source field must be provided.
 */
export const ImageInputSchema = z.object({
  blob: z.instanceof(Blob).optional(),
  url: z.string().url().optional(),
  base64: z.string().optional(),
  mimeType: ImageMimeTypeSchema.optional(),
}).refine(
  (data) => data.blob !== undefined || data.url !== undefined || data.base64 !== undefined,
  { message: 'At least one image source (blob, url, or base64) must be provided' },
);

export type ImageInput = z.infer<typeof ImageInputSchema>;

/**
 * Image output from AI providers (e.g., inpainting, background removal).
 * Represents a generated image without coupling to Fabric.js.
 */
export const GeneratedImageSchema = z.object({
  data: z.instanceof(Blob),
  mimeType: ImageMimeTypeSchema,
  width: z.number().positive().finite(),
  height: z.number().positive().finite(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type GeneratedImage = z.infer<typeof GeneratedImageSchema>;

/**
 * Optional metadata carried by AI results.
 * Typed as Record<string, unknown> — never `any`.
 * Providers should document the keys they populate.
 */
export type AIMetadata = Record<string, unknown>;

/**
 * Generic AI operation result wrapper.
 * Optional — prefer specific result types for individual providers.
 */
export interface AIResult<T> {
  data: T;
  metadata?: AIMetadata;
}
