import type { DetectedText } from '@/ai/types/ocr';
import { loadImageData } from '@/editor/masks/inpaint';

/**
 * ETAPA 36.4 — OCR text style estimation.
 *
 * Lightweight, deterministic, client-side estimation of the visual style of a
 * detected text region, so OCR TextElements are born closer to the raster
 * original. Only color is estimated at this stage (priority 1); font size,
 * position and alignment keep their existing fallbacks.
 *
 * No heavy model, no paid API, no extra round trip — pixels are processed from
 * the already-available source image on the client.
 */

/** Safe fallback color used when estimation confidence is too low. */
export const DEFAULT_TEXT_COLOR = '#000000';

/** Minimum confidence for an estimated color to be applied. */
export const MIN_COLOR_CONFIDENCE = 0.6;

export interface ColorEstimate {
  /** Hex color (`#rrggbb`). */
  color: string;
  /** Confidence in the [0, 1] range. */
  confidence: number;
}

const QUANT_LEVELS = 4;
const BORDER_WIDTH = 2;
const MIN_GLYPH_RATIO = 0.03;
const CONTRAST_THRESHOLD = 100;

type RGB = [number, number, number];

function quantizeColor([r, g, b]: RGB): number {
  const step = 256 / QUANT_LEVELS;
  const qr = Math.min(QUANT_LEVELS - 1, Math.floor(r / step));
  const qg = Math.min(QUANT_LEVELS - 1, Math.floor(g / step));
  const qb = Math.min(QUANT_LEVELS - 1, Math.floor(b / step));
  return (qr << 8) | (qg << 4) | qb;
}

function dequantizeColor(key: number): RGB {
  const step = 256 / QUANT_LEVELS;
  const qr = (key >> 8) & 0xf;
  const qg = (key >> 4) & 0xf;
  const qb = key & 0xf;
  return [
    Math.round(qr * step + step / 2),
    Math.round(qg * step + step / 2),
    Math.round(qb * step + step / 2),
  ];
}

function rgbDistance(a: RGB, b: RGB): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function toHex([r, g, b]: RGB): string {
  return (
    '#' +
    [r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')
  );
}

/**
 * Estimate the text (glyph) color of a detected region.
 *
 * Strategy (ETAPA 36.4, FASE 3.2-3.3): sample the border ring of the bounding
 * box to estimate the local background, then find interior pixels that contrast
 * with that background (glyph pixels), and return the dominant glyph color with
 * a confidence derived from cluster dominance and glyph coverage.
 *
 * Deterministic and DOM-free — operates on raw `ImageData`.
 */
export function estimateTextColor(
  imageData: ImageData,
  bbox: { x: number; y: number; width: number; height: number },
): ColorEstimate {
  const { width, height, data } = imageData;

  const x0 = Math.max(0, Math.floor(bbox.x));
  const y0 = Math.max(0, Math.floor(bbox.y));
  const x1 = Math.min(width - 1, Math.ceil(bbox.x + bbox.width) - 1);
  const y1 = Math.min(height - 1, Math.ceil(bbox.y + bbox.height) - 1);

  if (x1 <= x0 + 2 * BORDER_WIDTH || y1 <= y0 + 2 * BORDER_WIDTH) {
    return { color: DEFAULT_TEXT_COLOR, confidence: 0 };
  }

  const getPixel = (x: number, y: number): RGB => {
    const i = (y * width + x) * 4;
    return [data[i]!, data[i + 1]!, data[i + 2]!];
  };

  // 1. Background: quantized histogram over the border ring.
  const bgHist = new Map<number, number>();
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const isBorder =
        x < x0 + BORDER_WIDTH ||
        x > x1 - BORDER_WIDTH ||
        y < y0 + BORDER_WIDTH ||
        y > y1 - BORDER_WIDTH;
      if (isBorder) {
        const key = quantizeColor(getPixel(x, y));
        bgHist.set(key, (bgHist.get(key) ?? 0) + 1);
      }
    }
  }
  if (bgHist.size === 0) {
    return { color: DEFAULT_TEXT_COLOR, confidence: 0 };
  }

  let bgKey = 0;
  let bgMax = -1;
  for (const [key, count] of bgHist) {
    if (count > bgMax) {
      bgMax = count;
      bgKey = key;
    }
  }
  const bgColor = dequantizeColor(bgKey);

  // 2. Glyph pixels: interior pixels that contrast with the background.
  const fgHist = new Map<number, number>();
  let fgCount = 0;
  let total = 0;
  for (let y = y0 + BORDER_WIDTH; y <= y1 - BORDER_WIDTH; y++) {
    for (let x = x0 + BORDER_WIDTH; x <= x1 - BORDER_WIDTH; x++) {
      total += 1;
      const color = getPixel(x, y);
      if (rgbDistance(color, bgColor) > CONTRAST_THRESHOLD) {
        const key = quantizeColor(color);
        fgHist.set(key, (fgHist.get(key) ?? 0) + 1);
        fgCount += 1;
      }
    }
  }

  if (fgCount === 0 || fgCount / total < MIN_GLYPH_RATIO) {
    return { color: DEFAULT_TEXT_COLOR, confidence: 0 };
  }

  let fgKey = 0;
  let fgMax = -1;
  for (const [key, count] of fgHist) {
    if (count > fgMax) {
      fgMax = count;
      fgKey = key;
    }
  }
  const fgColor = dequantizeColor(fgKey);

  const dominance = fgMax / fgCount;
  const glyphRatio = fgCount / total;
  const confidence = Math.max(0, Math.min(1, dominance * 0.6 + glyphRatio * 0.4));

  // CHECKPOINT 36.5F — never discard a usable color because of low confidence.
  //
  // The confidence score is kept as metadata (for diagnostics/trace) but the
  // estimated glyph color is returned whenever a dominant foreground cluster
  // was actually found. `DEFAULT_TEXT_COLOR` is only used when there is no
  // glyph/background contrast at all (the early-return branches above), never
  // as a replacement for a real, if uncertain, color estimate.
  return { color: toHex(fgColor), confidence };
}

/**
 * Estimate colors for a set of detections from the source image.
 *
 * Best-effort: any failure (image load, canvas unavailable) returns fallback
 * estimates with confidence 0, so style estimation never fails the pipeline.
 */
export async function estimateTextStyles(
  src: string,
  detections: DetectedText[],
): Promise<ColorEstimate[]> {
  try {
    const imageData = await loadImageData(src);
    return detections.map((d) => estimateTextColor(imageData, d.boundingBox));
  } catch {
    return detections.map(() => ({ color: DEFAULT_TEXT_COLOR, confidence: 0 }));
  }
}
