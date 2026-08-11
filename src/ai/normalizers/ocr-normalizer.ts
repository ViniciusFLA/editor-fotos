import type { DetectedText, OCRResult } from '@/ai/types/ocr';
import type { AIMetadata } from '@/ai/types/common';
import { generateId } from '@/utils';

/**
 * Raw response type from Google Cloud Vision API text detection.
 * Restricted to fields actually used by the normalizer.
 */
interface GoogleVisionTextAnnotation {
  description: string;
  boundingPoly: {
    vertices: Array<{ x?: number; y?: number }>;
  };
  locale?: string;
}

interface GoogleVisionResponse {
  responses?: Array<{
    textAnnotations?: GoogleVisionTextAnnotation[];
    error?: { code: number; message: string };
  }>;
}

/**
 * Normalize a Google Cloud Vision text detection response
 * into the canonical DetectedText[] format.
 *
 * Coordinates are in PIXELS relative to the original image.
 * Google returns absolute pixel coordinates — used directly.
 */
export function normalizeGoogleOCRResponse(
  response: GoogleVisionResponse,
  imageWidth: number,
  imageHeight: number,
): OCRResult {
  if (!response.responses || response.responses.length === 0) {
    return { detectedTexts: [] };
  }

  const firstResponse = response.responses[0]!;

  if (firstResponse.error) {
    return { detectedTexts: [] };
  }

  const annotations = firstResponse.textAnnotations;
  if (!annotations || annotations.length === 0) {
    return { detectedTexts: [] };
  }

  // Google returns the FULL text as annotations[0] and individual words
  // as annotations[1..n]. We skip the full-text entry (index 0) and use
  // individual word/block entries for useful granularity.
  const wordAnnotations = annotations.slice(1);

  const detectedTexts: DetectedText[] = wordAnnotations.map((ann) => {
    const vertices = ann.boundingPoly?.vertices ?? [];

    const xs = vertices.map((v) => v.x ?? 0).filter((x) => !isNaN(x) && isFinite(x));
    const ys = vertices.map((v) => v.y ?? 0).filter((y) => !isNaN(y) && isFinite(y));

    const minX = xs.length > 0 ? Math.min(...xs) : 0;
    const minY = ys.length > 0 ? Math.min(...ys) : 0;
    const maxX = xs.length > 0 ? Math.max(...xs) : imageWidth;
    const maxY = ys.length > 0 ? Math.max(...ys) : imageHeight;

    const width = maxX - minX;
    const height = maxY - minY;

    const polygon = vertices
      .filter((v) => v.x != null && v.y != null)
      .map((v) => ({ x: v.x!, y: v.y! }));

    const metadata: AIMetadata = {};
    if (ann.locale) {
      metadata.googleLocale = ann.locale;
    }

    return {
      id: generateId(),
      text: ann.description,
      boundingBox: {
        x: Math.max(0, minX),
        y: Math.max(0, minY),
        width: Math.max(1, width),
        height: Math.max(1, height),
      },
      // Google TEXT_DETECTION does not provide per-word confidence.
      // confidence is left undefined (absent), not forced to 0.
      confidence: undefined,
      polygon: polygon.length >= 3 ? polygon : undefined,
      language: ann.locale || undefined,
      metadata,
    };
  });

  return { detectedTexts };
}
