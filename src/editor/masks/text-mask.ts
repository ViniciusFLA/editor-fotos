import type { DetectedText } from '@/ai/types/ocr';
import type { TextMask, TextMaskPoint } from '@/types';
import { generateId } from '@/utils';

/**
 * ETAPA 34 — Text Masks (pure mask construction).
 *
 * Builds a `TextMask` for each OCR detection that became an editable text
 * layer, using the real polygon (polygon-first) with a bounding-box fallback.
 * Confidence below the threshold is never masked (avoids wiping pixels on bad
 * OCR). Masks are expressed in natural-image pixel coordinates and are fully
 * independent of the text layer's later canvas position.
 */

/** Conservative default: mask only detections with meaningful confidence. */
export const DEFAULT_MIN_CONFIDENCE = 0.6;

/** Small configurable padding (px, natural image) around the detected region. */
export const DEFAULT_MASK_PADDING = 3;

export function shouldKeepDetectedText(
  detected: DetectedText,
  minConfidence: number = DEFAULT_MIN_CONFIDENCE,
): boolean {
  if (!detected.text || !detected.text.trim()) return false;
  const confidence = detected.confidence ?? 1;
  return confidence >= minConfidence;
}

/** True when a polygon has enough points to describe a region. */
export function isUsablePolygon(
  polygon: Array<{ x: number; y: number }> | undefined,
): polygon is TextMaskPoint[] {
  return Array.isArray(polygon) && polygon.length >= 3;
}

export interface BuildTextMasksOptions {
  minConfidence?: number;
  padding?: number;
}

export interface BuildTextMasksResult {
  masks: TextMask[];
  /** Indexes (into `detectedTexts`) that were masked. */
  maskedIndexes: number[];
}

/**
 * Build masks for the detections that became editable text layers.
 *
 * `textElements` must be the elements produced from the SAME `detectedTexts`
 * (same order and same filtering) so that `textLayerId` links correctly.
 */
export function buildTextMasks(
  detectedTexts: DetectedText[],
  textElements: Array<{ id: string }>,
  sourceImageId: string,
  options: BuildTextMasksOptions = {},
): BuildTextMasksResult {
  const minConfidence = options.minConfidence ?? DEFAULT_MIN_CONFIDENCE;
  const padding = options.padding ?? DEFAULT_MASK_PADDING;

  const masks: TextMask[] = [];
  const maskedIndexes: number[] = [];
  let elementCursor = 0;

  detectedTexts.forEach((detected, index) => {
    if (!shouldKeepDetectedText(detected, minConfidence)) return;

    const textElement = textElements[elementCursor];
    elementCursor += 1;

    if (!textElement) return;

    const polygon = isUsablePolygon(detected.polygon)
      ? detected.polygon.map((p) => ({ x: p.x, y: p.y }))
      : bboxToPolygon(detected.boundingBox);

    const boundingBox = {
      x: detected.boundingBox.x,
      y: detected.boundingBox.y,
      width: detected.boundingBox.width,
      height: detected.boundingBox.height,
    };

    masks.push({
      id: generateId(),
      sourceImageId,
      textLayerId: textElement.id,
      polygon,
      boundingBox,
      padding,
      enabled: true,
    });

    maskedIndexes.push(index);
  });

  return { masks, maskedIndexes };
}

function bboxToPolygon(box: {
  x: number;
  y: number;
  width: number;
  height: number;
}): TextMaskPoint[] {
  return [
    { x: box.x, y: box.y },
    { x: box.x + box.width, y: box.y },
    { x: box.x + box.width, y: box.y + box.height },
    { x: box.x, y: box.y + box.height },
  ];
}
