import { describe, it, expect } from 'vitest';
import {
  estimateTextColor,
  DEFAULT_TEXT_COLOR,
  MIN_COLOR_CONFIDENCE,
} from './text-style';

type RGB = [number, number, number];

function solid(width: number, height: number, rgb: RGB): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = rgb[0];
    data[i * 4 + 1] = rgb[1];
    data[i * 4 + 2] = rgb[2];
    data[i * 4 + 3] = 255;
  }
  return new ImageData(data, width, height);
}

/** Background color everywhere + a solid glyph rectangle in the center. */
function glyphImage(
  width: number,
  height: number,
  bg: RGB,
  glyphColor: RGB,
  glyphRect = { x: 30, y: 15, w: 40, h: 20 },
): ImageData {
  const img = solid(width, height, bg);
  for (let y = glyphRect.y; y < glyphRect.y + glyphRect.h; y++) {
    for (let x = glyphRect.x; x < glyphRect.x + glyphRect.w; x++) {
      const i = (y * width + x) * 4;
      img.data[i] = glyphColor[0];
      img.data[i + 1] = glyphColor[1];
      img.data[i + 2] = glyphColor[2];
    }
  }
  return img;
}

function parse(hex: string): RGB {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

describe('estimateTextColor (ETAPA 36.4)', () => {
  it('detects white text on black background', () => {
    const img = glyphImage(100, 50, [0, 0, 0], [255, 255, 255]);
    const est = estimateTextColor(img, { x: 10, y: 5, width: 80, height: 40 });
    const [r, g, b] = parse(est.color);
    expect(est.confidence).toBeGreaterThanOrEqual(MIN_COLOR_CONFIDENCE);
    expect(r).toBeGreaterThan(180);
    expect(g).toBeGreaterThan(180);
    expect(b).toBeGreaterThan(180);
  });

  it('detects black text on white background', () => {
    const img = glyphImage(100, 50, [255, 255, 255], [0, 0, 0]);
    const est = estimateTextColor(img, { x: 10, y: 5, width: 80, height: 40 });
    const [r, g, b] = parse(est.color);
    expect(est.confidence).toBeGreaterThanOrEqual(MIN_COLOR_CONFIDENCE);
    expect(r).toBeLessThan(80);
    expect(g).toBeLessThan(80);
    expect(b).toBeLessThan(80);
  });

  it('detects yellow text on blue background (not the background color)', () => {
    const img = glyphImage(100, 50, [0, 0, 255], [255, 255, 0]);
    const est = estimateTextColor(img, { x: 10, y: 5, width: 80, height: 40 });
    const [r, g, b] = parse(est.color);
    expect(est.confidence).toBeGreaterThanOrEqual(MIN_COLOR_CONFIDENCE);
    expect(r).toBeGreaterThan(180);
    expect(g).toBeGreaterThan(180);
    expect(b).toBeLessThan(100);
  });

  it('detects red text on white background', () => {
    const img = glyphImage(100, 50, [255, 255, 255], [255, 0, 0]);
    const est = estimateTextColor(img, { x: 10, y: 5, width: 80, height: 40 });
    const [r, g, b] = parse(est.color);
    expect(est.confidence).toBeGreaterThanOrEqual(MIN_COLOR_CONFIDENCE);
    expect(r).toBeGreaterThan(180);
    expect(g).toBeLessThan(100);
    expect(b).toBeLessThan(100);
  });

  it('detects blue text on white background', () => {
    const img = glyphImage(100, 50, [255, 255, 255], [0, 0, 255]);
    const est = estimateTextColor(img, { x: 10, y: 5, width: 80, height: 40 });
    const [r, g, b] = parse(est.color);
    expect(est.confidence).toBeGreaterThanOrEqual(MIN_COLOR_CONFIDENCE);
    expect(r).toBeLessThan(100);
    expect(g).toBeLessThan(100);
    expect(b).toBeGreaterThan(180);
  });

  it('detects black text over a light gradient background', () => {
    const width = 100;
    const height = 50;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const v = 120 + Math.floor((x / width) * 100); // light gradient 120..220
        const i = (y * width + x) * 4;
        data[i] = v;
        data[i + 1] = v;
        data[i + 2] = v;
        data[i + 3] = 255;
      }
    }
    // black glyph
    for (let y = 15; y < 35; y++) {
      for (let x = 30; x < 70; x++) {
        const i = (y * width + x) * 4;
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
      }
    }
    const img = new ImageData(data, width, height);
    const est = estimateTextColor(img, { x: 10, y: 5, width: 80, height: 40 });
    const [r, g, b] = parse(est.color);
    expect(est.confidence).toBeGreaterThanOrEqual(MIN_COLOR_CONFIDENCE);
    expect(r).toBeLessThan(80);
    expect(g).toBeLessThan(80);
    expect(b).toBeLessThan(80);
  });

  it('falls back when there is no glyph/background contrast', () => {
    const img = solid(100, 50, [128, 128, 128]);
    const est = estimateTextColor(img, { x: 10, y: 5, width: 80, height: 40 });
    expect(est.color).toBe(DEFAULT_TEXT_COLOR);
    expect(est.confidence).toBeLessThan(MIN_COLOR_CONFIDENCE);
  });

  it('falls back for a degenerate (too small) region', () => {
    const img = solid(10, 10, [0, 0, 0]);
    const est = estimateTextColor(img, { x: 0, y: 0, width: 4, height: 4 });
    expect(est.confidence).toBe(0);
    expect(est.color).toBe(DEFAULT_TEXT_COLOR);
  });
});
