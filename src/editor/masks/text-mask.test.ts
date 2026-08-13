import { describe, it, expect } from 'vitest';
import type { DetectedText } from '@/ai/types/ocr';
import {
  buildTextMasks,
  shouldKeepDetectedText,
  isUsablePolygon,
  DEFAULT_MIN_CONFIDENCE,
  DEFAULT_MASK_PADDING,
} from './text-mask';

function detected(overrides: Partial<DetectedText> = {}): DetectedText {
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

describe('shouldKeepDetectedText', () => {
  it('keeps non-empty text with confidence above threshold', () => {
    expect(shouldKeepDetectedText(detected(), 0.6)).toBe(true);
  });

  it('rejects empty / whitespace text', () => {
    expect(shouldKeepDetectedText(detected({ text: '' }), 0.6)).toBe(false);
    expect(shouldKeepDetectedText(detected({ text: '   ' }), 0.6)).toBe(false);
  });

  it('rejects low-confidence detections (noise)', () => {
    expect(shouldKeepDetectedText(detected({ confidence: 0.3 }), 0.6)).toBe(false);
  });

  it('treats missing confidence as full confidence', () => {
    expect(shouldKeepDetectedText(detected({ confidence: undefined }), 0.6)).toBe(true);
  });

  it('uses the default threshold when omitted', () => {
    expect(DEFAULT_MIN_CONFIDENCE).toBe(0.6);
    expect(shouldKeepDetectedText(detected({ confidence: 0.59 }))).toBe(false);
    expect(shouldKeepDetectedText(detected({ confidence: 0.61 }))).toBe(true);
  });
});

describe('isUsablePolygon', () => {
  it('accepts polygons with 3+ points', () => {
    expect(isUsablePolygon([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }])).toBe(true);
  });

  it('rejects undefined or too-few-points polygons', () => {
    expect(isUsablePolygon(undefined)).toBe(false);
    expect(isUsablePolygon([])).toBe(false);
    expect(isUsablePolygon([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe(false);
  });
});

describe('buildTextMasks', () => {
  it('creates one mask per kept detection, linked to the element', () => {
    const texts = [detected({ id: 'd1', text: 'A' }), detected({ id: 'd2', text: 'B' })];
    const elements = [{ id: 'el-1' }, { id: 'el-2' }];
    const { masks, maskedIndexes } = buildTextMasks(texts, elements, 'img-1');

    expect(masks).toHaveLength(2);
    expect(maskedIndexes).toEqual([0, 1]);
    expect(masks[0]!.textLayerId).toBe('el-1');
    expect(masks[1]!.textLayerId).toBe('el-2');
    expect(masks[0]!.sourceImageId).toBe('img-1');
    expect(masks.every((m) => m.enabled)).toBe(true);
  });

  it('skips low-confidence and empty text, preserving element linkage', () => {
    const texts = [
      detected({ id: 'd1', text: 'A', confidence: 0.9 }),
      detected({ id: 'd2', text: '', confidence: 0.9 }),
      detected({ id: 'd3', text: 'B', confidence: 0.2 }),
      detected({ id: 'd4', text: 'C', confidence: 0.8 }),
    ];
    const elements = [{ id: 'el-1' }, { id: 'el-2' }];
    const { masks, maskedIndexes } = buildTextMasks(texts, elements, 'img-1');

    // d1 -> el-1, d4 -> el-2 (d2 empty, d3 low confidence skipped)
    expect(masks).toHaveLength(2);
    expect(maskedIndexes).toEqual([0, 3]);
    expect(masks[0]!.textLayerId).toBe('el-1');
    expect(masks[1]!.textLayerId).toBe('el-2');
  });

  it('uses the real polygon when available (polygon-first)', () => {
    const polygon = [
      { x: 1, y: 1 },
      { x: 5, y: 1 },
      { x: 5, y: 3 },
      { x: 1, y: 3 },
    ];
    const texts = [detected({ polygon })];
    const { masks } = buildTextMasks(texts, [{ id: 'el-1' }], 'img-1');
    expect(masks[0]!.polygon).toEqual(polygon);
  });

  it('falls back to the bounding box when polygon is missing', () => {
    const texts = [detected({ polygon: undefined, boundingBox: { x: 2, y: 4, width: 8, height: 6 } })];
    const { masks } = buildTextMasks(texts, [{ id: 'el-1' }], 'img-1');
    expect(masks[0]!.polygon).toEqual([
      { x: 2, y: 4 },
      { x: 10, y: 4 },
      { x: 10, y: 10 },
      { x: 2, y: 10 },
    ]);
  });

  it('applies the configurable padding', () => {
    const { masks } = buildTextMasks([detected()], [{ id: 'el-1' }], 'img-1', {
      padding: 7,
    });
    expect(masks[0]!.padding).toBe(7);
  });

  it('uses the default padding when not specified', () => {
    const { masks } = buildTextMasks([detected()], [{ id: 'el-1' }], 'img-1');
    expect(masks[0]!.padding).toBe(DEFAULT_MASK_PADDING);
  });
});
