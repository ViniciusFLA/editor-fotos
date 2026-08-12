import type { ImageElement, TextElement } from '@/types';
import type { OCRResult } from '@/ai/types/ocr';
import { convertDetectedTextsToTextElements } from './ocr-to-elements';
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
  sourceImageId: string;
  sourcePageId: string;
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

  const blob = await fetchImageBlob(image.src);

  const formData = new FormData();
  formData.append('file', blob, 'image.png');

  let response: Response;
  try {
    response = await fetch('/api/ai/ocr', { method: 'POST', body: formData });
  } catch {
    throw new OcrFlowError('httpError', 'Network error');
  }

  if (!response.ok) {
    let message = 'OCR failed';
    try {
      message = extractErrorMessage(await response.json());
    } catch {
      // keep default message
    }
    throw new OcrFlowError('httpError', message);
  }

  const result = (await response.json()) as OCRResult;

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

  return { elements, sourceImageId, sourcePageId };
}
