import type { DetectedText, OCRResult } from '@/ai/types/ocr';
import type { ImageElement, PageData, TextElement, TextMask } from '@/types';
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

/**
 * Run the full editable-text pipeline (stages 1–7) and produce a validated
 * result ready for an atomic state commit.
 *
 * Throws `EditableTextPipelineError` before any caller-side mutation when the
 * input is empty, every detection is filtered, or inpainting fails — so the
 * caller never commits a partial state.
 */
export async function processOcrResult(
  input: ProcessEditableTextInput,
): Promise<EditableTextPipelineResult> {
  const started = Date.now();
  const { sourceImage, ocrResult } = input;
  const config = input.config;

  const detections = ocrResult.detectedTexts ?? [];
  const detectionsReceived = detections.length;

  if (detectionsReceived === 0) {
    throw new EditableTextPipelineError('noTextDetected', 'No text detected');
  }

  const { elements, masks, rejectedDetections } = buildEditableTextElementsAndMasks(input);

  if (elements.length === 0) {
    throw new EditableTextPipelineError(
      'allDetectionsFiltered',
      'All detections were filtered out',
    );
  }

  const baseSrc = sourceImage.originalSrc ?? sourceImage.src;
  const inpaint = config?.inpaint ?? applyMasksToImage;
  const maxRadius = config?.maxRadius ?? DEFAULT_MAX_RADIUS;

  let maskedImageSrc: string;
  try {
    const masked = await inpaint(baseSrc, masks, { maxRadius });
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
    masks,
    maskedImageSrc,
    originalSrc: baseSrc,
    rejectedDetections,
    metrics: {
      detectionsReceived,
      detectionsAccepted: elements.length,
      detectionsRejected: rejectedDetections.length,
      masksCreated: masks.length,
      textLayersCreated: elements.length,
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
