import { describe, it, expect } from 'vitest';
import type { DetectedText, OCRResult } from '@/ai/types/ocr';
import type { AnyElement, ImageElement, PageData, PageBackground, TextElement, TextMask } from '@/types';
import {
  processOcrResult,
  classifyDetections,
  buildEditableTextElementsAndMasks,
  hasValidGeometry,
  isImageAlreadyProcessed,
  isResultStale,
  EditableTextPipelineError,
  type InpaintFn,
  type BuildEditableTextInput,
} from './editable-text-pipeline';
import { useEditorStore } from '@/stores/editor-store';

function detection(overrides: Partial<DetectedText> = {}): DetectedText {
  return {
    id: 'd1',
    text: 'CONFIRA',
    boundingBox: { x: 10, y: 20, width: 100, height: 30 },
    confidence: 0.99,
    polygon: [
      { x: 10, y: 20 },
      { x: 110, y: 20 },
      { x: 110, y: 50 },
      { x: 10, y: 50 },
    ],
    ...overrides,
  };
}

function sourceImage(overrides: Partial<ImageElement> = {}): ImageElement {
  return {
    id: 'img-1',
    type: 'image',
    name: 'Imagem',
    x: 0,
    y: 0,
    width: 1000,
    height: 1000,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    zIndex: 1,
    assetId: 'a1',
    src: 'data:image/png;base64,ORIG',
    cropX: 0,
    cropY: 0,
    cropWidth: 1000,
    cropHeight: 1000,
    flipX: false,
    flipY: false,
    filters: {
      brightness: 0,
      contrast: 0,
      saturation: 0,
      blur: 0,
      grayscale: false,
    },
    naturalWidth: 1000,
    naturalHeight: 1000,
    ...overrides,
  };
}

function ocrResult(detectedTexts: DetectedText[]): OCRResult {
  return { detectedTexts };
}

function textElement(overrides: Partial<TextElement> = {}): TextElement {
  return {
    id: 'el-1',
    type: 'text',
    name: 'Text — A',
    x: 0,
    y: 0,
    width: 100,
    height: 30,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    zIndex: 5,
    text: 'A',
    fontFamily: 'Arial',
    fontSize: 20,
    fontWeight: 'normal',
    fontStyle: 'normal',
    textAlign: 'left',
    fill: '#000000',
    letterSpacing: 0,
    lineHeight: 1.2,
    ...overrides,
  };
}

function textMask(overrides: Partial<TextMask> = {}): TextMask {
  return {
    id: 'm1',
    sourceImageId: 'img-1',
    textLayerId: 'el-1',
    polygon: [
      { x: 10, y: 20 },
      { x: 110, y: 20 },
      { x: 110, y: 50 },
      { x: 10, y: 50 },
    ],
    boundingBox: { x: 10, y: 20, width: 100, height: 30 },
    padding: 3,
    enabled: true,
    ...overrides,
  };
}

function page(id: string, elements: AnyElement[] = []): PageData {
  const background: PageBackground = {
    type: 'color',
    color: '#ffffff',
    src: '',
    assetId: '',
    gradientStops: [],
    direction: 0,
  };
  return { id, name: `Page ${id}`, pageNumber: 1, width: 1080, height: 1080, background, elements };
}

const mockInpaint: InpaintFn = async () => ({
  src: 'data:image/png;base64,MASKED',
  width: 1000,
  height: 1000,
});

function processInput(
  overrides: Partial<BuildEditableTextInput> = {},
): BuildEditableTextInput {
  return {
    sourceImage: sourceImage(),
    ocrResult: ocrResult([detection()]),
    sourcePageId: 'page-1',
    ...overrides,
  };
}

describe('ETAPA 36 — editable text pipeline', () => {
  describe('processOcrResult — happy path', () => {
    it('produces elements, linked masks and a masked image', async () => {
      const r = await processOcrResult(
        processInput({ config: { inpaint: mockInpaint } }),
      );

      expect(r.success).toBe(true);
      expect(r.elements).toHaveLength(1);
      expect(r.masks).toHaveLength(1);
      expect(r.maskedImageSrc).toBe('data:image/png;base64,MASKED');
      expect(r.originalSrc).toBe('data:image/png;base64,ORIG');
      expect(r.rejectedDetections).toEqual([]);
      expect(r.metrics).toMatchObject({
        detectionsReceived: 1,
        detectionsAccepted: 1,
        detectionsRejected: 0,
        masksCreated: 1,
        textLayersCreated: 1,
      });
    });

    it('links each mask to its text layer (mask↔layer linkage)', async () => {
      const texts = [
        detection({ id: 'd1', text: 'A' }),
        detection({ id: 'd2', text: 'B', boundingBox: { x: 10, y: 60, width: 100, height: 30 } }),
      ];
      const r = await processOcrResult(
        processInput({ ocrResult: ocrResult(texts), config: { inpaint: mockInpaint } }),
      );

      expect(r.masks.map((m) => m.textLayerId)).toEqual(r.elements.map((el) => el.id));
      expect(r.masks.every((m) => m.sourceImageId === 'img-1')).toBe(true);
      expect(r.masks.every((m) => m.enabled)).toBe(true);
    });
  });

  describe('confidence filtering', () => {
    it('rejects low-confidence detections with a reason', () => {
      const texts = [
        detection({ id: 'd1', text: 'A', confidence: 0.99 }),
        detection({ id: 'd2', text: 'B', confidence: 0.3 }),
      ];
      const { accepted, rejected } = classifyDetections(texts, 0.6);

      expect(accepted.map((d) => d.id)).toEqual(['d1']);
      expect(rejected).toEqual([{ index: 1, id: 'd2', reason: 'lowConfidence' }]);
    });

    it('treats missing confidence as full confidence', () => {
      const { accepted } = classifyDetections([detection({ confidence: undefined })], 0.6);
      expect(accepted).toHaveLength(1);
    });
  });

  describe('geometry validation', () => {
    it('accepts a detection with invalid polygon but valid bbox (bbox fallback)', async () => {
      const texts = [
        detection({
          polygon: [{ x: 0, y: 0 }], // unusable (1 point)
          boundingBox: { x: 10, y: 20, width: 100, height: 30 },
        }),
      ];
      const r = await processOcrResult(
        processInput({ ocrResult: ocrResult(texts), config: { inpaint: mockInpaint } }),
      );
      expect(r.elements).toHaveLength(1);
      // mask fell back to the bbox rectangle
      expect(r.masks[0]!.polygon).toEqual([
        { x: 10, y: 20 },
        { x: 110, y: 20 },
        { x: 110, y: 50 },
        { x: 10, y: 50 },
      ]);
    });

    it('rejects a detection with invalid polygon and invalid bbox', () => {
      const texts = [
        detection({
          polygon: undefined,
          boundingBox: { x: NaN, y: NaN, width: 0, height: -1 },
        }),
      ];
      const { accepted, rejected } = classifyDetections(texts, 0.6);
      expect(accepted).toHaveLength(0);
      expect(rejected).toEqual([{ index: 0, id: 'd1', reason: 'invalidGeometry' }]);
      expect(hasValidGeometry(texts[0]!)).toBe(false);
    });
  });

  describe('partial invalid detections', () => {
    it('processes valid regions and rejects only the invalid ones', async () => {
      const texts = [
        detection({ id: 'd1', text: 'A', confidence: 0.99 }),
        detection({ id: 'd2', text: 'B', confidence: 0.2 }), // low confidence
        detection({ id: 'd3', text: '', confidence: 0.99 }), // empty text
        detection({ id: 'd4', text: 'C', confidence: 0.98, boundingBox: { x: NaN, y: 0, width: 0, height: 0 } }), // invalid geometry
        detection({ id: 'd5', text: 'D', confidence: 0.97, boundingBox: { x: 10, y: 90, width: 100, height: 30 } }),
      ];
      const r = await processOcrResult(
        processInput({ ocrResult: ocrResult(texts), config: { inpaint: mockInpaint } }),
      );

      expect(r.elements.map((el) => el.text)).toEqual(['A', 'D']);
      expect(r.rejectedDetections).toEqual([
        { index: 1, id: 'd2', reason: 'lowConfidence' },
        { index: 2, id: 'd3', reason: 'emptyText' },
        { index: 3, id: 'd4', reason: 'invalidGeometry' },
      ]);
      expect(r.metrics).toMatchObject({
        detectionsReceived: 5,
        detectionsAccepted: 2,
        detectionsRejected: 3,
      });
    });
  });

  describe('empty / fully filtered results', () => {
    it('throws noTextDetected when OCR returns no detections', async () => {
      await expect(
        processOcrResult(processInput({ ocrResult: ocrResult([]) })),
      ).rejects.toMatchObject({ code: 'noTextDetected' });
    });

    it('throws allDetectionsFiltered when every detection is rejected', async () => {
      const texts = [detection({ confidence: 0.1 }), detection({ text: '' })];
      await expect(
        processOcrResult(processInput({ ocrResult: ocrResult(texts) })),
      ).rejects.toMatchObject({ code: 'allDetectionsFiltered' });
    });
  });

  describe('inpainting integration (deterministic by default, injectable)', () => {
    it('passes the preserved original source and masks to the provider', async () => {
      const img = sourceImage({
        src: 'data:image/png;base64,CURRENT',
        originalSrc: 'data:image/png;base64,PRESERVED',
      });
      const calls: Array<{ src: string; masks: TextMask[] }> = [];
      const spy: InpaintFn = async (src, masks) => {
        calls.push({ src, masks });
        return { src: 'data:image/png;base64,MASKED', width: 1, height: 1 };
      };

      const r = await processOcrResult(
        processInput({
          sourceImage: img,
          config: { inpaint: spy },
        }),
      );

      expect(calls).toHaveLength(1);
      expect(calls[0]!.src).toBe('data:image/png;base64,PRESERVED');
      expect(calls[0]!.masks).toHaveLength(1);
      expect(r.originalSrc).toBe('data:image/png;base64,PRESERVED');
    });

    it('throws inpaintingFailed when the provider fails (no partial result)', async () => {
      const failing: InpaintFn = async () => {
        throw new Error('boom');
      };
      await expect(
        processOcrResult(processInput({ config: { inpaint: failing } })),
      ).rejects.toMatchObject({ code: 'inpaintingFailed' });
    });
  });

  describe('buildEditableTextElementsAndMasks', () => {
    it('creates masks only for accepted detections', () => {
      const texts = [
        detection({ id: 'd1', text: 'A' }),
        detection({ id: 'd2', text: 'B', confidence: 0.1 }),
      ];
      const out = buildEditableTextElementsAndMasks(
        processInput({ ocrResult: ocrResult(texts) }),
      );
      expect(out.elements).toHaveLength(1);
      expect(out.masks).toHaveLength(1);
      expect(out.acceptedDetections).toHaveLength(1);
      expect(out.rejectedDetections).toHaveLength(1);
    });
  });

  describe('idempotency / stale result', () => {
    it('flags an image that already has detected text', () => {
      expect(isImageAlreadyProcessed(sourceImage({ originalSrc: undefined }))).toBe(false);
      expect(
        isImageAlreadyProcessed(sourceImage({ originalSrc: 'data:image/png;base64,X' })),
      ).toBe(true);
    });

    it('treats a missing page as stale', () => {
      expect(isResultStale([page('p1')], 'p2', 'img-1')).toBe(true);
    });

    it('treats a deleted source image as stale', () => {
      expect(isResultStale([page('p1', [])], 'p1', 'img-1')).toBe(true);
    });

    it('is not stale when page and image still exist', () => {
      expect(isResultStale([page('p1', [sourceImage()])], 'p1', 'img-1')).toBe(false);
    });
  });

  describe('atomic state commit', () => {
    it('commits image update and text layers in a single store update', () => {
      const img = sourceImage({ id: 'img-1', src: 'data:image/png;base64,ORIG' });
      useEditorStore.setState({
        pages: [page('p1', [img])],
        activePageId: 'p1',
        elements: [img],
      });

      const mask = textMask({ sourceImageId: 'img-1', textLayerId: 'el-1' });
      const el = textElement({ id: 'el-1' });

      useEditorStore.getState().commitEditableTextResult('p1', 'img-1', {
        maskedImageSrc: 'data:image/png;base64,MASKED',
        masks: [mask],
        elements: [el],
        originalSrc: 'data:image/png;base64,ORIG',
      });

      const state = useEditorStore.getState();
      expect(state.elements).toHaveLength(2);

      const updated = state.elements.find((e) => e.id === 'img-1') as ImageElement;
      expect(updated.src).toBe('data:image/png;base64,MASKED');
      expect(updated.originalSrc).toBe('data:image/png;base64,ORIG');
      expect(updated.textMasks).toEqual([mask]);

      expect(state.pages[0]!.elements).toHaveLength(2);
      expect(state.pages[0]!.elements.find((e) => e.id === 'el-1')).toEqual(el);
    });

    it('commits to the source page without contaminating the active page', () => {
      const img = sourceImage({ id: 'img-1' });
      useEditorStore.setState({
        pages: [page('p1', [img]), page('p2', [])],
        activePageId: 'p2',
        elements: [],
      });

      useEditorStore.getState().commitEditableTextResult('p1', 'img-1', {
        maskedImageSrc: 'data:image/png;base64,MASKED',
        masks: [textMask()],
        elements: [textElement()],
        originalSrc: 'data:image/png;base64,ORIG',
      });

      const state = useEditorStore.getState();
      expect(state.elements).toHaveLength(0); // active page (p2) untouched
      expect(state.pages.find((p) => p.id === 'p1')!.elements).toHaveLength(2);
      expect(state.pages.find((p) => p.id === 'p2')!.elements).toHaveLength(0);
    });
  });

  describe('error class', () => {
    it('carries a typed code', () => {
      const err = new EditableTextPipelineError('noTextDetected', 'x');
      expect(err.code).toBe('noTextDetected');
      expect(err.name).toBe('EditableTextPipelineError');
    });
  });
});
