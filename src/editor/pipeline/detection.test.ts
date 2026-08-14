import { describe, it, expect } from 'vitest';
import type { DetectedText } from '@/ai/types/ocr';
import type { ImageElement, TextElement, TextMask } from '@/types';
import {
  processDetections,
  convertDetectedRegions,
  convertArmedRegion,
  type InpaintFn,
} from './editable-text-pipeline';
import type { ColorEstimate } from '@/editor/ocr/text-style';
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
    filters: { brightness: 0, contrast: 0, saturation: 0, blur: 0, grayscale: false },
    naturalWidth: 1000,
    naturalHeight: 1000,
    ...overrides,
  };
}

const mockInpaint: InpaintFn = async () => ({
  src: 'data:image/png;base64,MASKED',
  width: 1000,
  height: 1000,
});

const mockStyles = async (
  _src: string,
  detections: DetectedText[],
): Promise<ColorEstimate[]> =>
  detections.map(() => ({ color: '#ff0000', confidence: 0.9 }));

describe('processDetections (CHECKPOINT 36.5 — detection only)', () => {
  it('stores detected regions without masks or elements', async () => {
    const result = await processDetections({
      sourceImage: sourceImage(),
      ocrResult: { detectedTexts: [detection()] },
      sourcePageId: 'p1',
      config: { estimateStyles: mockStyles },
    });

    expect(result.regions).toHaveLength(1);
    const region = result.regions[0]!;
    expect(region.status).toBe('detected');
    expect(region.sourceImageId).toBe('img-1');
    expect(region.text).toBe('CONFIRA');
    expect(region.styleEstimate?.color).toBe('#ff0000');
    expect(result.metrics.masksCreated).toBe(0);
    expect(result.metrics.textLayersCreated).toBe(0);
  });

  it('does not create masks or TextElements (pure detection)', async () => {
    const result = await processDetections({
      sourceImage: sourceImage(),
      ocrResult: { detectedTexts: [detection(), detection({ id: 'd2', text: 'B', boundingBox: { x: 10, y: 60, width: 100, height: 30 } })] },
      sourcePageId: 'p1',
      config: { estimateStyles: mockStyles },
    });
    expect(result.regions).toHaveLength(2);
  });

  it('throws noTextDetected when OCR is empty', async () => {
    await expect(
      processDetections({
        sourceImage: sourceImage(),
        ocrResult: { detectedTexts: [] },
        sourcePageId: 'p1',
      }),
    ).rejects.toMatchObject({ code: 'noTextDetected' });
  });
});

describe('convertDetectedRegions (CHECKPOINT 36.5)', () => {
  it('converts a single region into a mask and TextElement', async () => {
    const detections = await processDetections({
      sourceImage: sourceImage(),
      ocrResult: { detectedTexts: [detection()] },
      sourcePageId: 'p1',
      config: { estimateStyles: mockStyles },
    });

    const result = await convertDetectedRegions({
      regions: detections.regions,
      sourceImage: sourceImage(),
      sourcePageId: 'p1',
      config: { inpaint: mockInpaint },
    });

    expect(result.elements).toHaveLength(1);
    expect(result.masks).toHaveLength(1);
    expect(result.maskedImageSrc).toBe('data:image/png;base64,MASKED');
    // estimated color applied
    expect(result.elements[0]!.fill).toBe('#ff0000');
  });

  it('merges existing masks cumulatively', async () => {
    const existing: TextMask = {
      id: 'existing-mask',
      sourceImageId: 'img-1',
      textLayerId: 'existing-text',
      polygon: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ],
      boundingBox: { x: 0, y: 0, width: 10, height: 10 },
      padding: 3,
      enabled: true,
    };

    const detections = await processDetections({
      sourceImage: sourceImage(),
      ocrResult: { detectedTexts: [detection()] },
      sourcePageId: 'p1',
      config: { estimateStyles: mockStyles },
    });

    const calls: TextMask[][] = [];
    const spy: InpaintFn = async (src, masks) => {
      calls.push(masks);
      return { src: 'data:image/png;base64,MASKED', width: 1, height: 1 };
    };

    await convertDetectedRegions({
      regions: detections.regions,
      sourceImage: sourceImage(),
      sourcePageId: 'p1',
      existingMasks: [existing],
      config: { inpaint: spy },
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.length).toBe(2); // existing + new
    expect(calls[0]![0]!.id).toBe('existing-mask');
  });

  it('converts all regions when passed the full set', async () => {
    const detections = await processDetections({
      sourceImage: sourceImage(),
      ocrResult: {
        detectedTexts: [
          detection({ id: 'd1', text: 'A' }),
          detection({ id: 'd2', text: 'B', boundingBox: { x: 10, y: 60, width: 100, height: 30 } }),
        ],
      },
      sourcePageId: 'p1',
      config: { estimateStyles: mockStyles },
    });

    const result = await convertDetectedRegions({
      regions: detections.regions,
      sourceImage: sourceImage(),
      sourcePageId: 'p1',
      config: { inpaint: mockInpaint },
    });

    expect(result.elements).toHaveLength(2);
    expect(result.masks).toHaveLength(2);
    expect(result.masks.map((m) => m.textLayerId)).toEqual(result.elements.map((e) => e.id));
  });

  it('convertArmedRegion uses the caller element and links its mask (CHECKPOINT 36.5C)', async () => {
    const detections = await processDetections({
      sourceImage: sourceImage(),
      ocrResult: { detectedTexts: [detection()] },
      sourcePageId: 'p1',
      config: { estimateStyles: mockStyles },
    });

    const element: TextElement = {
      id: 'armed-element-id',
      type: 'text',
      name: 'Text',
      x: 100,
      y: 100,
      width: 200,
      height: 40,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      zIndex: 5,
      text: '150%',
      fontFamily: 'Arial',
      fontSize: 30,
      fontWeight: 'bold',
      fontStyle: 'normal',
      textAlign: 'left',
      fill: '#ffcc00',
      letterSpacing: 0,
      lineHeight: 1.2,
    };

    const result = await convertArmedRegion({
      region: detections.regions[0]!,
      sourceImage: sourceImage(),
      element,
      existingMasks: [],
      config: { inpaint: mockInpaint },
    });

    expect(result.element.id).toBe('armed-element-id');
    expect(result.element.text).toBe('150%');
    expect(result.masks).toHaveLength(1);
    expect(result.masks[0]!.textLayerId).toBe('armed-element-id');
    expect(result.maskedImageSrc).toBe('data:image/png;base64,MASKED');
    expect(result.originalSrc).toBe('data:image/png;base64,ORIG');
  });
});

describe('store: detection does not alter image (CHECKPOINT 36.5)', () => {
  it('storeDetections sets detectedTexts without changing src or masks', () => {
    const img = sourceImage({ id: 'img-1' });
    useEditorStore.setState({
      pages: [{ id: 'p1', name: 'p1', pageNumber: 1, width: 1080, height: 1080, background: { type: 'color', color: '#fff', src: '', assetId: '', gradientStops: [], direction: 0 }, elements: [img] }],
      activePageId: 'p1',
      elements: [img],
    });

    const regions = [
      {
        id: 'r1',
        sourceImageId: 'img-1',
        text: 'CONFIRA',
        confidence: 0.9,
        polygon: [] as Array<{ x: number; y: number }>,
        boundingBox: { x: 0, y: 0, width: 10, height: 10 },
        status: 'detected' as const,
      },
    ];

    useEditorStore.getState().storeDetections('p1', 'img-1', regions);

    const updated = useEditorStore.getState().elements.find((e) => e.id === 'img-1') as ImageElement;
    expect(updated.src).toBe('data:image/png;base64,ORIG'); // unchanged
    expect(updated.textMasks).toBeUndefined(); // no masks
    expect(updated.detectedTexts).toEqual(regions);
  });

  it('commitRegionConversion marks only converted regions', () => {
    const img = sourceImage({
      id: 'img-1',
      detectedTexts: [
        { id: 'r1', sourceImageId: 'img-1', text: 'A', confidence: 0.9, polygon: [], boundingBox: { x: 0, y: 0, width: 10, height: 10 }, status: 'detected' },
        { id: 'r2', sourceImageId: 'img-1', text: 'B', confidence: 0.9, polygon: [], boundingBox: { x: 0, y: 0, width: 10, height: 10 }, status: 'detected' },
      ],
    });
    useEditorStore.setState({
      pages: [{ id: 'p1', name: 'p1', pageNumber: 1, width: 1080, height: 1080, background: { type: 'color', color: '#fff', src: '', assetId: '', gradientStops: [], direction: 0 }, elements: [img] }],
      activePageId: 'p1',
      elements: [img],
    });

    const el: TextElement = {
      id: 'text-new',
      type: 'text',
      name: 'Text',
      x: 0, y: 0, width: 100, height: 30, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, visible: true, locked: false, zIndex: 5,
      text: 'A', fontFamily: 'Arial', fontSize: 20, fontWeight: 'normal', fontStyle: 'normal', textAlign: 'left', fill: '#000', letterSpacing: 0, lineHeight: 1.2,
    };
    const mask: TextMask = {
      id: 'm1', sourceImageId: 'img-1', textLayerId: 'text-new',
      polygon: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }],
      boundingBox: { x: 0, y: 0, width: 10, height: 10 }, padding: 3, enabled: true,
    };

    useEditorStore.getState().commitRegionConversion('p1', 'img-1', {
      maskedImageSrc: 'data:image/png;base64,MASKED',
      masks: [mask],
      elements: [el],
      originalSrc: 'data:image/png;base64,ORIG',
      convertedRegionIds: ['r1'],
    });

    const updated = useEditorStore.getState().elements.find((e) => e.id === 'img-1') as ImageElement;
    expect(updated.src).toBe('data:image/png;base64,MASKED');
    expect(updated.detectedTexts!.find((r) => r.id === 'r1')!.status).toBe('converted');
    expect(updated.detectedTexts!.find((r) => r.id === 'r2')!.status).toBe('detected');
  });
});
