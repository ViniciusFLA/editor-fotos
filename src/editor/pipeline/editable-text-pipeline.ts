import type { DetectedText, OCRResult } from '@/ai/types/ocr';
import type { DetectedTextRegion, ImageElement, PageData, TextElement, TextMask } from '@/types';
import { convertDetectedTextsToTextElements } from '@/editor/ocr/ocr-to-elements';
import {
  buildTextMasks,
  DEFAULT_MIN_CONFIDENCE,
  DEFAULT_MASK_PADDING,
} from '@/editor/masks/text-mask';
import {
  applyMasksToImage,
  DEFAULT_MAX_RADIUS,
  type InpaintOptions,
  type ApplyMasksResult,
} from '@/editor/masks/inpaint';
import {
  estimateTextStyles,
  MIN_COLOR_CONFIDENCE,
  type ColorEstimate,
} from '@/editor/ocr/text-style';

/**
 * ETAPA 36 — Editable Text Pipeline.
 *
 * Centralizes the OCR → confidence/filter → mask → inpainting → TextElement
 * flow into a single, transactional, testable orchestrator.
 *
 * This module is pure with respect to React/Fabric/Zustand:
 *  - `classifyDetections` / `buildEditableTextElementsAndMasks` are synchronous
 *    and side-effect free;
 *  - `processOcrResult` only awaits the (injectable) inpainting step;
 *  - the caller (CanvasArea) is responsible for the state commit and Fabric
 *    synchronization, which it performs atomically.
 *
 * The deterministic inpainting strategy from ETAPA 35 is the default provider;
 * `config.inpaint` lets a future provider (LaMa/ONNX or a hosted service) be
 * injected without rewriting the editor.
 */

export type EditableTextPipelineErrorCode =
  | 'noTextDetected'
  | 'allDetectionsFiltered'
  | 'inpaintingFailed';

export class EditableTextPipelineError extends Error {
  readonly code: EditableTextPipelineErrorCode;

  constructor(code: EditableTextPipelineErrorCode, message: string) {
    super(message);
    this.name = 'EditableTextPipelineError';
    this.code = code;
  }
}

export type RejectionReason = 'emptyText' | 'lowConfidence' | 'invalidGeometry';

export interface RejectedDetection {
  /** Index into the original OCR `detectedTexts` array. */
  index: number;
  id: string;
  reason: RejectionReason;
}

/** Injectable inpainting function (deterministic by default). */
export type InpaintFn = (
  src: string,
  masks: TextMask[],
  options?: InpaintOptions,
) => Promise<ApplyMasksResult>;

export interface EditableTextPipelineConfig {
  /** Minimum confidence to accept a detection (default `DEFAULT_MIN_CONFIDENCE`). */
  minConfidence?: number;
  /** Mask padding in natural-image pixels (default `DEFAULT_MASK_PADDING`). */
  padding?: number;
  /** Inpainting max search radius (default `DEFAULT_MAX_RADIUS`). */
  maxRadius?: number;
  /** Inpainting provider (defaults to the deterministic local strategy). */
  inpaint?: InpaintFn;
  /** Text color estimator (defaults to the local `estimateTextStyles`). */
  estimateStyles?: (src: string, detections: DetectedText[]) => Promise<ColorEstimate[]>;
}

export interface EditableTextPipelineMetrics {
  detectionsReceived: number;
  detectionsAccepted: number;
  detectionsRejected: number;
  masksCreated: number;
  textLayersCreated: number;
  durationMs: number;
}

export interface EditableTextPipelineResult {
  success: true;
  elements: TextElement[];
  masks: TextMask[];
  /** Data URL of the masked image (text removed). */
  maskedImageSrc: string;
  /** The immutable pre-masking source the recomputation is based on. */
  originalSrc: string;
  rejectedDetections: RejectedDetection[];
  metrics: EditableTextPipelineMetrics;
}

export interface BuildEditableTextInput {
  sourceImage: ImageElement;
  ocrResult: OCRResult;
  sourcePageId: string;
  /** First zIndex for the created layers (defaults to source image + 1). */
  baseZIndex?: number;
  config?: EditableTextPipelineConfig;
}

export interface BuildEditableTextOutput {
  elements: TextElement[];
  masks: TextMask[];
  acceptedDetections: DetectedText[];
  rejectedDetections: RejectedDetection[];
}

/** A bounding box is usable when all fields are finite and positive. */
export function hasValidBoundingBox(detected: DetectedText): boolean {
  const b = detected.boundingBox;
  if (!b) return false;
  return (
    Number.isFinite(b.x) &&
    Number.isFinite(b.y) &&
    Number.isFinite(b.width) &&
    Number.isFinite(b.height) &&
    b.width > 0 &&
    b.height > 0
  );
}

/**
 * Geometry validation gate (ETAPA 36, FASE 7).
 *
 * Text-layer placement and mask geometry both depend on a valid bounding box,
 * so a detection is only processable when its bounding box is valid. A valid
 * bounding box with a missing/degenerate polygon still passes (bbox fallback in
 * `buildTextMasks`); a detection with an invalid bounding box is rejected
 * regardless of its polygon.
 */
export function hasValidGeometry(detected: DetectedText): boolean {
  return hasValidBoundingBox(detected);
}

/**
 * Partition OCR detections into accepted / rejected with a concrete reason.
 *
 * A rejected detection never generates a mask, wipes pixels, or produces a
 * TextElement. One bad region must not fail the whole pipeline.
 */
export function classifyDetections(
  detectedTexts: DetectedText[],
  minConfidence: number = DEFAULT_MIN_CONFIDENCE,
): { accepted: DetectedText[]; rejected: RejectedDetection[] } {
  const accepted: DetectedText[] = [];
  const rejected: RejectedDetection[] = [];

  detectedTexts.forEach((detected, index) => {
    if (!detected.text || !detected.text.trim()) {
      rejected.push({ index, id: detected.id, reason: 'emptyText' });
      return;
    }

    const confidence = detected.confidence ?? 1;
    if (confidence < minConfidence) {
      rejected.push({ index, id: detected.id, reason: 'lowConfidence' });
      return;
    }

    if (!hasValidGeometry(detected)) {
      rejected.push({ index, id: detected.id, reason: 'invalidGeometry' });
      return;
    }

    accepted.push(detected);
  });

  return { accepted, rejected };
}

/**
 * Build the editable text elements and their linked masks from an OCR result.
 *
 * Reuses the ETAPA 33 element mapping and the ETAPA 34 mask engine (no second
 * mask engine), keeping the polygon-first → bbox-fallback → padding behaviour
 * and the `textLayerId` ↔ `sourceImageId` linkage intact.
 */
export function buildEditableTextElementsAndMasks(
  input: BuildEditableTextInput,
): BuildEditableTextOutput {
  const { sourceImage, ocrResult, sourcePageId, baseZIndex } = input;
  const minConfidence = input.config?.minConfidence ?? DEFAULT_MIN_CONFIDENCE;
  const padding = input.config?.padding ?? DEFAULT_MASK_PADDING;

  const detections = ocrResult.detectedTexts ?? [];
  const { accepted, rejected } = classifyDetections(detections, minConfidence);

  const startZ = baseZIndex ?? Math.max(0, sourceImage.zIndex) + 1;

  const elements = convertDetectedTextsToTextElements({
    result: { detectedTexts: accepted },
    sourceImage,
    sourcePageId,
    baseZIndex: startZ,
    minConfidence,
  });

  const { masks } = buildTextMasks(accepted, elements, sourceImage.id, {
    minConfidence,
    padding,
  });

  return {
    elements,
    masks,
    acceptedDetections: accepted,
    rejectedDetections: rejected,
  };
}

export type ProcessEditableTextInput = BuildEditableTextInput;

export interface ProcessDetectionsResult {
  regions: DetectedTextRegion[];
  rejectedDetections: RejectedDetection[];
  metrics: EditableTextPipelineMetrics;
}

function regionToDetected(region: DetectedTextRegion): DetectedText {
  return {
    id: region.id,
    text: region.text,
    confidence: region.confidence,
    polygon: region.polygon.length >= 3 ? region.polygon : undefined,
    boundingBox: region.boundingBox,
  };
}

/**
 * ETAPA 36.5 — detection only (no visual change).
 *
 * OCR → confidence filtering → geometry validation → style estimation →
 * stored `DetectedTextRegion[]`. Does NOT build masks, run inpainting, or
 * create TextElements — the raster stays visually identical to the original.
 */
export async function processDetections(
  input: ProcessEditableTextInput,
): Promise<ProcessDetectionsResult> {
  const started = Date.now();
  const { sourceImage, ocrResult } = input;
  const config = input.config;
  const minConfidence = config?.minConfidence ?? DEFAULT_MIN_CONFIDENCE;

  const detections = ocrResult.detectedTexts ?? [];
  const detectionsReceived = detections.length;

  if (detectionsReceived === 0) {
    throw new EditableTextPipelineError('noTextDetected', 'No text detected');
  }

  const { accepted, rejected } = classifyDetections(detections, minConfidence);

  if (accepted.length === 0) {
    throw new EditableTextPipelineError(
      'allDetectionsFiltered',
      'All detections were filtered out',
    );
  }

  const baseSrc = sourceImage.originalSrc ?? sourceImage.src;

  let styles: ColorEstimate[] = [];
  try {
    const estimateStyles = config?.estimateStyles ?? estimateTextStyles;
    styles = await estimateStyles(baseSrc, accepted);
  } catch {
    styles = [];
  }

  const regions: DetectedTextRegion[] = accepted.map((detected, i) => {
    const style = styles[i];
    return {
      id: detected.id,
      sourceImageId: sourceImage.id,
      text: detected.text,
      confidence: detected.confidence ?? 1,
      polygon: detected.polygon ?? [],
      boundingBox: { ...detected.boundingBox },
      styleEstimate:
        style && style.confidence >= MIN_COLOR_CONFIDENCE
          ? { color: style.color, colorConfidence: style.confidence }
          : undefined,
      status: 'detected',
    };
  });

  return {
    regions,
    rejectedDetections: rejected,
    metrics: {
      detectionsReceived,
      detectionsAccepted: regions.length,
      detectionsRejected: rejected.length,
      masksCreated: 0,
      textLayersCreated: 0,
      durationMs: Date.now() - started,
    },
  };
}

export interface ConvertDetectedRegionsInput {
  regions: DetectedTextRegion[];
  sourceImage: ImageElement;
  sourcePageId: string;
  /** First zIndex for the created layers (defaults to source image + 1). */
  baseZIndex?: number;
  /** Masks already applied (previously-converted regions) — merged cumulatively. */
  existingMasks?: TextMask[];
  config?: EditableTextPipelineConfig;
}

/**
 * ETAPA 36.5 — convert a subset of detected regions into editable text.
 *
 * Reuses the ETAPA 33/34 machinery: builds masks (polygon-first → bbox
 * fallback), runs deterministic inpainting over the CUMULATIVE masks (existing
 * + new), and creates the TextElements positioned over the original region.
 */
export async function convertDetectedRegions(
  input: ConvertDetectedRegionsInput,
): Promise<EditableTextPipelineResult> {
  const started = Date.now();
  const { regions, sourceImage, sourcePageId, baseZIndex } = input;
  const config = input.config;
  const padding = config?.padding ?? DEFAULT_MASK_PADDING;

  if (regions.length === 0) {
    throw new EditableTextPipelineError('noTextDetected', 'No regions to convert');
  }

  const detections: DetectedText[] = regions.map(regionToDetected);

  const startZ = baseZIndex ?? Math.max(0, sourceImage.zIndex) + 1;

  const elements = convertDetectedTextsToTextElements({
    result: { detectedTexts: detections },
    sourceImage,
    sourcePageId,
    baseZIndex: startZ,
    minConfidence: 0, // regions were already filtered during detection
  });

  elements.forEach((el, i) => {
    const style = regions[i]?.styleEstimate;
    if (style?.color) {
      el.fill = style.color;
    }
  });

  const { masks: newMasks } = buildTextMasks(detections, elements, sourceImage.id, {
    minConfidence: 0,
    padding,
  });

  const allMasks = [...(input.existingMasks ?? []), ...newMasks];

  const baseSrc = sourceImage.originalSrc ?? sourceImage.src;
  const inpaint = config?.inpaint ?? applyMasksToImage;
  const maxRadius = config?.maxRadius ?? DEFAULT_MAX_RADIUS;

  let maskedImageSrc: string;
  try {
    const masked = await inpaint(baseSrc, allMasks, { maxRadius });
    maskedImageSrc = masked.src;
  } catch {
    throw new EditableTextPipelineError(
      'inpaintingFailed',
      'Failed to reconstruct the background',
    );
  }

  return {
    success: true,
    elements,
    masks: newMasks,
    maskedImageSrc,
    originalSrc: baseSrc,
    rejectedDetections: [],
    metrics: {
      detectionsReceived: regions.length,
      detectionsAccepted: elements.length,
      detectionsRejected: 0,
      masksCreated: newMasks.length,
      textLayersCreated: elements.length,
      durationMs: Date.now() - started,
    },
  };
}

/**
 * Run the full editable-text pipeline (detect + convert all) and produce a
 * validated result ready for an atomic state commit.
 *
 * Backward-compatible with the ETAPA 36 behaviour; the interactive flow
 * (CHECKPOINT 36.5) uses `processDetections` + `convertDetectedRegions`.
 */
export async function processOcrResult(
  input: ProcessEditableTextInput,
): Promise<EditableTextPipelineResult> {
  const started = Date.now();

  const { regions, rejectedDetections, metrics: detectionMetrics } =
    await processDetections(input);

  const converted = await convertDetectedRegions({
    regions,
    sourceImage: input.sourceImage,
    sourcePageId: input.sourcePageId,
    baseZIndex: input.baseZIndex,
    existingMasks: [],
    config: input.config,
  });

  return {
    ...converted,
    rejectedDetections,
    metrics: {
      detectionsReceived: detectionMetrics.detectionsReceived,
      detectionsAccepted: converted.elements.length,
      detectionsRejected: rejectedDetections.length,
      masksCreated: converted.masks.length,
      textLayersCreated: converted.elements.length,
      durationMs: Date.now() - started,
    },
  };
}

/**
 * Idempotency signal: an image is considered already processed once it has a
 * preserved `originalSrc` (ETAPA 34 sets it only after a first successful run).
 */
export function isImageAlreadyProcessed(image: ImageElement): boolean {
  return typeof image.originalSrc === 'string' && image.originalSrc.length > 0;
}

/**
 * Stale-result gate (ETAPA 36, FASE 20–22): true when the source page or image
 * no longer exists, so a finished OCR result must be discarded rather than
 * applied to a missing/other element.
 */
export function isResultStale(
  pages: PageData[],
  pageId: string,
  imageId: string,
): boolean {
  const page = pages.find((p) => p.id === pageId);
  if (!page) return true;
  return !page.elements.some((el) => el.id === imageId);
}
