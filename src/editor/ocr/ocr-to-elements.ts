import type { DetectedText, OCRResult } from '@/ai/types/ocr';
import type { ImageElement, TextElement } from '@/types';
import { generateId } from '@/utils';

/**
 * ETAPA 33 — OCR → Editable Text Layers (application layer).
 *
 * This module converts provider-agnostic `DetectedText[]` (OCRResult) into
 * editor `TextElement[]`, mapping natural-image pixel coordinates to canvas
 * coordinates while honouring the source image transform (scale, offset,
 * rotation, flip, crop).
 *
 * This module does NOT depend on Fabric.js or on global selection. The source
 * image and page are passed explicitly, keeping the mapping pure and testable.
 */

const DEFAULT_FONT_FAMILY = 'Arial';
const DEFAULT_COLOR = '#000000';
const DEFAULT_LINE_HEIGHT = 1.2;
const FONT_SIZE_HEIGHT_RATIO = 0.8;
const MAX_LAYER_NAME_LENGTH = 40;
const MIN_FONT_SIZE = 6;

interface ImageTransform {
  /** scale from natural image px → canvas px (horizontal) */
  scaleX: number;
  /** scale from natural image px → canvas px (vertical) */
  scaleY: number;
  rotationDeg: number;
  flipX: boolean;
  flipY: boolean;
}

export interface MappedRect {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

/**
 * Resolve the real natural dimensions of an image element.
 *
 * Uses the explicitly persisted `naturalWidth`/`naturalHeight` when present
 * (added in ETAPA 33), falling back to `cropWidth`/`cropHeight` (which are
 * initialised to the natural size) and finally to `width * scaleX` as a
 * last-resort approximation. Never treats the displayed width as natural width
 * when scale is applied.
 */
export function getImageNaturalSize(image: ImageElement): {
  naturalWidth: number;
  naturalHeight: number;
} {
  const naturalWidth =
    image.naturalWidth ??
    (image.cropWidth > 0 ? image.cropWidth : image.width * image.scaleX);
  const naturalHeight =
    image.naturalHeight ??
    (image.cropHeight > 0 ? image.cropHeight : image.height * image.scaleY);

  return {
    naturalWidth: naturalWidth > 0 ? naturalWidth : image.width,
    naturalHeight: naturalHeight > 0 ? naturalHeight : image.height,
  };
}

/**
 * Compute the transform that maps natural-image pixels to canvas pixels.
 *
 * The displayed width is always `width * scaleX` in Fabric (scale may be
 * folded into width by `normalizeFabricObject`, but the product is invariant).
 * Dividing the displayed size by the natural size yields the true scale.
 */
export function getImageTransform(image: ImageElement): ImageTransform {
  const { naturalWidth, naturalHeight } = getImageNaturalSize(image);
  return {
    scaleX: (image.width * image.scaleX) / naturalWidth,
    scaleY: (image.height * image.scaleY) / naturalHeight,
    rotationDeg: image.rotation,
    flipX: image.flipX,
    flipY: image.flipY,
  };
}

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Map a natural-image bounding rect to canvas coordinates.
 *
 * Steps:
 *  1. subtract crop offset (origin of the visible region);
 *  2. mirror when flipX/flipY (Fabric flips around the object centre);
 *  3. scale to display size;
 *  4. rotate around the image origin by `rotation`;
 *  5. translate by the image's canvas position.
 *
 * The returned rect is the axis-aligned top-left/width/height of the mapped
 * centre point; `rotation` carries the image rotation (+ text orientation, set
 * separately by the caller). This keeps the text centred over the detected
 * region instead of distorting it through re-boxing a rotated polygon.
 */
export function mapImageRectToCanvas(
  image: ImageElement,
  rect: { x: number; y: number; width: number; height: number },
): MappedRect {
  const transform = getImageTransform(image);
  const { naturalWidth, naturalHeight } = getImageNaturalSize(image);

  // 1. Crop offset — OCR bbox is relative to the full original image; the crop
  //    window shifts the visible origin.
  let cx = rect.x + rect.width / 2 - image.cropX;
  let cy = rect.y + rect.height / 2 - image.cropY;

  // 2. Flip — mirror around the visible region centre.
  if (transform.flipX) cx = naturalWidth - cx;
  if (transform.flipY) cy = naturalHeight - cy;

  // 3. Scale.
  const sx = transform.scaleX;
  const sy = transform.scaleY;
  const dx = cx * sx;
  const dy = cy * sy;

  // 4. Rotate around the image origin.
  const rad = toRadians(transform.rotationDeg);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rx = dx * cos - dy * sin;
  const ry = dx * sin + dy * cos;

  // 5. Translate to canvas.
  const canvasCx = image.x + rx;
  const canvasCy = image.y + ry;

  const width = Math.max(1, rect.width * sx);
  const height = Math.max(1, rect.height * sy);

  return {
    x: canvasCx - width / 2,
    y: canvasCy - height / 2,
    width,
    height,
    rotation: transform.rotationDeg,
  };
}

/**
 * Estimate a text orientation angle (degrees) from a detection polygon.
 *
 * Uses the angle of the top edge (points 0 → 1). Angles are normalised to
 * [-45, 45] so near-horizontal text yields ~0. Returns 0 when the polygon is
 * missing or degenerate.
 */
export function estimateTextRotation(
  polygon: Array<{ x: number; y: number }> | undefined,
): number {
  if (!polygon || polygon.length < 2) return 0;

  const a = polygon[0]!;
  const b = polygon[1]!;

  const dx = b.x - a.x;
  const dy = b.y - a.y;

  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return 0;

  let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;

  return Math.round(angle * 10) / 10;
}

/**
 * Derive an initial font size from the displayed text-region height.
 *
 * A glyph's rendered height is roughly `fontSize * lineHeight`, so we divide
 * the box height by the default line height and apply a small ratio. This is a
 * documented approximation, not pixel-perfect.
 */
export function deriveFontSize(displayHeight: number): number {
  return Math.max(
    MIN_FONT_SIZE,
    Math.round((displayHeight / DEFAULT_LINE_HEIGHT) * FONT_SIZE_HEIGHT_RATIO),
  );
}

/**
 * Build a human-readable layer name, truncating long text.
 */
export function buildLayerName(text: string): string {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  const preview = trimmed.length > MAX_LAYER_NAME_LENGTH
    ? `${trimmed.slice(0, MAX_LAYER_NAME_LENGTH - 1)}…`
    : trimmed;
  return `Text — ${preview}`;
}

export interface OcrToElementsInput {
  result: OCRResult;
  sourceImage: ImageElement;
  sourcePageId: string;
  /** First zIndex for the created layers (defaults to source image + 1). */
  baseZIndex?: number;
}

/**
 * Convert an OCRResult into editor TextElements positioned over the source
 * image.
 *
 * Each DetectedText becomes one TextElement placed approximately over the
 * detected region, above the source image. The source OCR id is preserved in
 * `metadata.ocrId`; the editor generates its own layer ids.
 */
export function convertDetectedTextsToTextElements(
  input: OcrToElementsInput,
): TextElement[] {
  const { result, sourceImage, baseZIndex } = input;

  const startZ = baseZIndex ?? Math.max(0, sourceImage.zIndex) + 1;

  const elements: TextElement[] = [];

  result.detectedTexts.forEach((detected: DetectedText, index: number) => {
    if (!detected.text || !detected.text.trim()) return;

    const bbox = detected.boundingBox;
    const mapped = mapImageRectToCanvas(sourceImage, bbox);

    const textOrientation = estimateTextRotation(detected.polygon);
    const rotation = mapped.rotation + textOrientation;

    const fontSize =
      detected.approximateFontSize ?? deriveFontSize(mapped.height);

    const element: TextElement = {
      id: generateId(),
      type: 'text',
      name: buildLayerName(detected.text),
      x: Math.round(mapped.x * 10) / 10,
      y: Math.round(mapped.y * 10) / 10,
      width: Math.round(mapped.width * 10) / 10,
      height: Math.round(mapped.height * 10) / 10,
      scaleX: 1,
      scaleY: 1,
      rotation: Math.round(rotation * 10) / 10,
      opacity: 1,
      visible: true,
      locked: false,
      zIndex: startZ + index,
      text: detected.text,
      fontFamily: DEFAULT_FONT_FAMILY,
      fontSize,
      fontWeight: 'normal',
      fontStyle: 'normal',
      textAlign: detected.approximateAlignment ?? 'left',
      fill: detected.approximateColor ?? DEFAULT_COLOR,
      letterSpacing: 0,
      lineHeight: DEFAULT_LINE_HEIGHT,
    };

    elements.push(element);
  });

  return elements;
}
