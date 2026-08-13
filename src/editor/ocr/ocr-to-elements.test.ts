import { describe, it, expect } from 'vitest';
import type { ImageElement } from '@/types';
import type { OCRResult } from '@/ai/types/ocr';
import {
  convertDetectedTextsToTextElements,
  getImageNaturalSize,
  mapImageRectToCanvas,
} from './ocr-to-elements';
import { buildTextMasks } from '@/editor/masks/text-mask';

function sourceImage(overrides: Partial<ImageElement> = {}): ImageElement {
  return {
    id: 'img-1',
    type: 'image',
    name: 'Imagem',
    x: 100,
    y: 100,
    width: 1000,
    height: 1000,
    scaleX: 0.5,
    scaleY: 0.5,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    zIndex: 1,
    assetId: 'a1',
    src: 'data:image/png;base64,AAAA',
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

function result(): OCRResult {
  return {
    detectedTexts: [
      {
        id: 'd1',
        text: 'PROMOÇÃO',
        boundingBox: { x: 100, y: 100, width: 300, height: 50 },
        confidence: 0.99,
        polygon: [
          { x: 100, y: 100 },
          { x: 400, y: 100 },
          { x: 400, y: 150 },
          { x: 100, y: 150 },
        ],
      },
      {
        id: 'd2',
        text: '(c', // low-confidence noise
        boundingBox: { x: 500, y: 500, width: 20, height: 20 },
        confidence: 0.3,
      },
      {
        id: 'd3',
        text: 'CONFIRA',
        boundingBox: { x: 100, y: 200, width: 200, height: 40 },
        confidence: 0.95,
        polygon: [
          { x: 100, y: 200 },
          { x: 300, y: 200 },
          { x: 300, y: 240 },
          { x: 100, y: 240 },
        ],
      },
    ],
  };
}

describe('ETAPA 34 — OCR → layers above image (flow invariant)', () => {
  it('creates text layers above the source image (zIndex)', () => {
    const img = sourceImage({ zIndex: 3 });
    const elements = convertDetectedTextsToTextElements({
      result: result(),
      sourceImage: img,
      sourcePageId: 'page-1',
      baseZIndex: 5,
    });

    // only confident texts become layers (d2 noise rejected)
    expect(elements).toHaveLength(2);
    expect(elements.every((el) => el.zIndex >= 5 && el.zIndex > img.zIndex)).toBe(true);
    expect(elements.map((el) => el.text)).toEqual(['PROMOÇÃO', 'CONFIRA']);
  });

  it('produces linked, enabled masks for each created layer', () => {
    const img = sourceImage();
    const elements = convertDetectedTextsToTextElements({
      result: result(),
      sourceImage: img,
      sourcePageId: 'page-1',
    });
    const { masks } = buildTextMasks(result().detectedTexts, elements, img.id);

    expect(masks).toHaveLength(2);
    expect(masks.map((m) => m.textLayerId)).toEqual(elements.map((el) => el.id));
    expect(masks.every((m) => m.enabled)).toBe(true);
    expect(masks.every((m) => m.sourceImageId === img.id)).toBe(true);
  });
});

describe('getImageNaturalSize', () => {
  it('prefers persisted naturalWidth/naturalHeight', () => {
    const img = sourceImage({ naturalWidth: 2000, naturalHeight: 1500 });
    expect(getImageNaturalSize(img)).toEqual({ naturalWidth: 2000, naturalHeight: 1500 });
  });

  it('falls back to crop dimensions when natural is absent', () => {
    const img = sourceImage({ naturalWidth: undefined, naturalHeight: undefined });
    expect(getImageNaturalSize(img)).toEqual({ naturalWidth: 1000, naturalHeight: 1000 });
  });
});

describe('mapImageRectToCanvas', () => {
  it('maps a natural rect into canvas coordinates with scale', () => {
    const img = sourceImage({ x: 100, y: 100, scaleX: 0.5, scaleY: 0.5 });
    const mapped = mapImageRectToCanvas(img, { x: 0, y: 0, width: 200, height: 100 });
    // centre (100, 50) * 0.5 + origin (100, 100) => (150, 125); size (100, 50)
    expect(mapped.x).toBeCloseTo(100);
    expect(mapped.y).toBeCloseTo(100);
    expect(mapped.width).toBeCloseTo(100);
    expect(mapped.height).toBeCloseTo(50);
  });
});
