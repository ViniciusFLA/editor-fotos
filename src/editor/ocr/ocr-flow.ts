import type { ImageElement } from '@/types';
import type { OCRResult } from '@/ai/types/ocr';
import { useEditorStore } from '@/stores/editor-store';
import { isImageAlreadyProcessed } from '@/editor/pipeline/editable-text-pipeline';

/**
 * ETAPA 33 / 36 — client-side OCR retrieval.
 *
 * Retrieves the raw OCR result for the selected image and performs the source
 * safety checks (page/image existence) and the idempotency guard. The
 * processing (confidence filter → mask → inpainting → TextElement) lives in
 * `EditableTextPipeline` (`@/editor/pipeline/editable-text-pipeline`); the
 * caller (CanvasArea) owns the atomic state commit and Fabric synchronization.
 */

export type OcrFlowErrorCode =
  | 'requiresSingleImage'
  | 'imageFetchFailed'
  | 'httpError'
  | 'serviceUnavailable'
  | 'pageRemoved'
  | 'imageRemoved'
  | 'alreadyProcessed';

export class OcrFlowError extends Error {
  readonly code: OcrFlowErrorCode;

  constructor(code: OcrFlowErrorCode, message: string) {
    super(message);
    this.name = 'OcrFlowError';
    this.code = code;
  }
}

export interface OcrFetchResult {
  result: OCRResult;
  sourceImage: ImageElement;
  sourcePageId: string;
  sourceImageId: string;
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

/**
 * Select the source image, guard against re-entry on an already-processed
 * image, run OCR against the service, and verify the source page/image still
 * exist before returning the raw result.
 */
export async function fetchOcrResult(): Promise<OcrFetchResult> {
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

  // Idempotency: do not re-run on an image that already has detected text.
  if (isImageAlreadyProcessed(image)) {
    throw new OcrFlowError('alreadyProcessed', 'Image already has detected text');
  }

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

  return { result, sourceImage: image, sourcePageId, sourceImageId };
}
