import type { ImageElement, TextElement, TextMask } from '@/types';
import type { OCRResult } from '@/ai/types/ocr';
import { convertDetectedTextsToTextElements } from './ocr-to-elements';
import { buildTextMasks } from '@/editor/masks/text-mask';
import { applyMasksToImage } from '@/editor/masks/inpaint';
import { useEditorStore } from '@/stores/editor-store';

/**
 * ETAPA 33 — client-side OCR flow.
 *
 * Orchestrates: selected ImageElement → blob → POST /api/ai/ocr → OCRResult →
 * TextElement[] with page/image safety checks. It does NOT touch Fabric.js —
 * canvas insertion is the responsibility of the caller (CanvasArea).
 */

export type OcrFlowErrorCode =
  | 'requiresSingleImage'
  | 'imageFetchFailed'
  | 'httpError'
  | 'serviceUnavailable'
  | 'pageRemoved'
  | 'imageRemoved';

export class OcrFlowError extends Error {
  readonly code: OcrFlowErrorCode;

  constructor(code: OcrFlowErrorCode, message: string) {
    super(message);
    this.name = 'OcrFlowError';
    this.code = code;
  }
}

export interface OcrFlowResult {
  elements: TextElement[];
  masks: TextMask[];
  /** Blob URL of the masked image (text removed), or null when no mask. */
  maskedImageSrc: string | null;
  sourceImageId: string;
  sourcePageId: string;
}

const RETRYABLE_STATUSES = new Set([429, 502, 504]);
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 8000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchImageBlob(src: string): Promise<Blob> {
  let response: Response;
  try {
    response = await fetch(src);
  } catch {
    throw new OcrFlowError('imageFetchFailed', 'Failed to fetch image');
  }

  if (!response.ok) {
    throw new OcrFlowError('imageFetchFailed', 'Failed to fetch image');
  }

  return await response.blob();
}

function extractErrorMessage(data: unknown): string {
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (typeof obj.error === 'string' && obj.error) return obj.error;
    if (typeof obj.message === 'string' && obj.message) return obj.message;
  }
  return 'OCR failed';
}

async function postOcr(formData: FormData): Promise<OCRResult> {
  let lastStatus = 0;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let response: Response;
    try {
      response = await fetch('/api/ai/ocr', { method: 'POST', body: formData });
    } catch {
      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      throw new OcrFlowError('httpError', 'Network error');
    }

    if (response.ok) {
      console.info('[OCR UI] request completed: status=200');
      return (await response.json()) as OCRResult;
    }

    lastStatus = response.status;

    if (RETRYABLE_STATUSES.has(response.status) && attempt < MAX_ATTEMPTS) {
      console.info(`[OCR UI] transient ${response.status}, retrying (${attempt}/${MAX_ATTEMPTS - 1})...`);
      await sleep(RETRY_DELAY_MS);
      continue;
    }

    let message = 'OCR failed';
    try {
      message = extractErrorMessage(await response.json());
    } catch {
      // keep default message
    }

    if (RETRYABLE_STATUSES.has(response.status)) {
      throw new OcrFlowError('serviceUnavailable', message);
    }

    throw new OcrFlowError('httpError', message);
  }

  if (RETRYABLE_STATUSES.has(lastStatus)) {
    throw new OcrFlowError('serviceUnavailable', 'OCR service unavailable');
  }

  throw new OcrFlowError('httpError', 'OCR failed');
}

export async function runOcrDetectText(): Promise<OcrFlowResult> {
  const store = useEditorStore.getState();

  const selected = store.elements.filter((el) =>
    store.selectedElementIds.includes(el.id),
  );

  if (selected.length !== 1 || selected[0]?.type !== 'image') {
    throw new OcrFlowError('requiresSingleImage', 'Select exactly one image');
  }

  const image = selected[0] as ImageElement;
  const sourcePageId = store.activePageId;
  const sourceImageId = image.id;

  const blob = await fetchImageBlob(image.originalSrc ?? image.src);
  console.info(`[OCR UI] file prepared: type=${blob.type || 'unknown'}, size=${blob.size}`);

  const formData = new FormData();
  formData.append('file', blob, 'image.png');

  const result = await postOcr(formData);

  console.info(`[OCR UI] detected=${result.detectedTexts?.length ?? 0}`);

  // Page safety: the source page must still exist.
  const current = useEditorStore.getState();
  const sourcePage = current.pages.find((p) => p.id === sourcePageId);
  if (!sourcePage) {
    throw new OcrFlowError('pageRemoved', 'Source page was removed');
  }

  // Source image safety: the image must not have been deleted while OCR ran.
  const imageStillExists = sourcePage.elements.some(
    (el) => el.id === sourceImageId,
  );
  if (!imageStillExists) {
    throw new OcrFlowError('imageRemoved', 'Source image was removed');
  }

  const elements = convertDetectedTextsToTextElements({
    result,
    sourceImage: image,
    sourcePageId,
    baseZIndex: Math.max(0, ...sourcePage.elements.map((el) => el.zIndex)) + 1,
  });

  const { masks } = buildTextMasks(result.detectedTexts, elements, sourceImageId);

  let maskedImageSrc: string | null = null;
  if (masks.length > 0) {
    const baseSrc = image.originalSrc ?? image.src;
    try {
      const masked = await applyMasksToImage(baseSrc, masks);
      maskedImageSrc = masked.src;
    } catch (error) {
      console.warn('[OCR UI] inpainting failed, keeping original image', error);
    }
  }

  console.info(`[OCR UI] created=${elements.length} masks=${masks.length}`);

  return { elements, masks, maskedImageSrc, sourceImageId, sourcePageId };
}
