import type { TextMask, TextMaskPoint } from '@/types';

/**
 * ETAPA 34 — deterministic, local inpainting.
 *
 * Removes raster text by filling masked pixels with an inverse-distance
 * weighted average of the nearest surrounding (unmasked) pixels. Pure and
 * deterministic; no external service, no generative model. Runs client-side.
 *
 * Quality target: good on solid / gradient / simple-texture backgrounds;
 * acceptable-but-limited on complex photographs (documented limitation).
 */

export const DEFAULT_MAX_RADIUS = 96;

const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];

export interface InpaintOptions {
  maxRadius?: number;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

export async function loadImageData(src: string): Promise<ImageData> {
  const img = await loadImage(src);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function pointInPolygon(px: number, py: number, polygon: TextMaskPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i]!.x;
    const yi = polygon[i]!.y;
    const xj = polygon[j]!.x;
    const yj = polygon[j]!.y;
    const intersect =
      (yi > py) !== (yj > py) &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function polygonBounds(polygon: TextMaskPoint[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of polygon) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

/** Rasterize a single mask into a full-size binary buffer. */
function rasterizeMask(
  mask: TextMask,
  width: number,
  height: number,
): Uint8Array {
  const buf = new Uint8Array(width * height);
  const { minX, minY, maxX, maxY } = polygonBounds(mask.polygon);
  const pad = mask.padding;

  const x0 = Math.max(0, Math.floor(minX) - 1);
  const y0 = Math.max(0, Math.floor(minY) - 1);
  const x1 = Math.min(width - 1, Math.ceil(maxX) + 1);
  const y1 = Math.min(height - 1, Math.ceil(maxY) + 1);

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (pointInPolygon(x + 0.5, y + 0.5, mask.polygon)) {
        buf[y * width + x] = 1;
      }
    }
  }

  if (pad > 0) {
    dilateInPlace(buf, width, height, x0, y0, x1, y1, pad);
  }

  return buf;
}

/**
 * Dilate the marked region within [x0..x1]×[y0..y1] by `passes` pixels using
 * a 3×3 box structuring element (bounded to the padded local window).
 */
function dilateInPlace(
  buf: Uint8Array,
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  passes: number,
): void {
  const expand = passes;
  const lx = Math.max(0, x0 - expand);
  const ly = Math.max(0, y0 - expand);
  const hx = Math.min(width - 1, x1 + expand);
  const hy = Math.min(height - 1, y1 + expand);

  let cur = new Uint8Array(width * height);
  cur.set(buf.subarray(ly * width, (hy + 1) * width), ly * width);

  for (let p = 0; p < passes; p++) {
    const next = new Uint8Array(width * height);
    next.set(cur.subarray(ly * width, (hy + 1) * width), ly * width);
    for (let y = ly; y <= hy; y++) {
      for (let x = lx; x <= hx; x++) {
        const i = y * width + x;
        if (!cur[i]) continue;
        if (x > 0) next[i - 1] = 1;
        if (x < width - 1) next[i + 1] = 1;
        if (y > 0) next[i - width] = 1;
        if (y < height - 1) next[i + width] = 1;
        if (x > 0 && y > 0) next[i - width - 1] = 1;
        if (x < width - 1 && y > 0) next[i - width + 1] = 1;
        if (x > 0 && y < height - 1) next[i + width - 1] = 1;
        if (x < width - 1 && y < height - 1) next[i + width + 1] = 1;
      }
    }
    cur = next;
  }

  buf.set(cur.subarray(ly * width, (hy + 1) * width), ly * width);
}

/** Combine all enabled masks into a single binary buffer. */
export function rasterizeMasks(
  masks: TextMask[],
  width: number,
  height: number,
): Uint8Array {
  const combined = new Uint8Array(width * height);

  for (const mask of masks) {
    if (!mask.enabled) continue;
    const single = rasterizeMask(mask, width, height);
    for (let i = 0; i < combined.length; i++) {
      if (single[i]) combined[i] = 1;
    }
  }

  return combined;
}

/** Fill masked pixels with an inverse-distance weighted neighbourhood average. */
export function inpaintImageData(
  source: ImageData,
  mask: Uint8Array,
  options: InpaintOptions = {},
): ImageData {
  const maxRadius = options.maxRadius ?? DEFAULT_MAX_RADIUS;
  const { width, height, data } = source;
  const out = new Uint8ClampedArray(data);
  const anyMasked = mask.some((v) => v === 1);
  if (!anyMasked) return new ImageData(out, width, height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!mask[idx]) continue;

      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let wSum = 0;

      for (const [dx, dy] of DIRECTIONS) {
        let px = x + dx;
        let py = y + dy;
        let dist = 1;
        let found = false;

        while (
          dist <= maxRadius &&
          px >= 0 &&
          px < width &&
          py >= 0 &&
          py < height
        ) {
          if (!mask[py * width + px]) {
            found = true;
            break;
          }
          px += dx;
          py += dy;
          dist += 1;
        }

        if (!found) continue;

        const base = (py * width + px) * 4;
        const w = 1 / dist;
        rSum += data[base] * w;
        gSum += data[base + 1] * w;
        bSum += data[base + 2] * w;
        wSum += w;
      }

      const outBase = idx * 4;
      if (wSum > 0) {
        out[outBase] = rSum / wSum;
        out[outBase + 1] = gSum / wSum;
        out[outBase + 2] = bSum / wSum;
      }
    }
  }

  return new ImageData(out, width, height);
}

function imageDataToDataUrl(
  imageData: ImageData,
  mimeType: string,
): string {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL(mimeType);
}

export interface ApplyMasksResult {
  /** Data URL of the masked image (self-contained, no blob lifecycle). */
  src: string;
  width: number;
  height: number;
}

/**
 * Apply the enabled masks to `src`, returning a data URL of the masked image.
 * When no mask is enabled, the original `src` is returned unchanged.
 */
export async function applyMasksToImage(
  src: string,
  masks: TextMask[],
  options: InpaintOptions = {},
): Promise<ApplyMasksResult> {
  const enabled = masks.filter((m) => m.enabled);
  if (enabled.length === 0) {
    const imageData = await loadImageData(src);
    return { src, width: imageData.width, height: imageData.height };
  }

  const imageData = await loadImageData(src);
  const mask = rasterizeMasks(enabled, imageData.width, imageData.height);
  const inpainted = inpaintImageData(imageData, mask, options);
  const maskedSrc = imageDataToDataUrl(inpainted, 'image/png');

  return { src: maskedSrc, width: imageData.width, height: imageData.height };
}
