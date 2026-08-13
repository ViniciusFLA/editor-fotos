import { describe, it, expect } from 'vitest';
import type { TextMask } from '@/types';
import { rasterizeMasks, inpaintImageData } from './inpaint';

function makeMask(overrides: Partial<TextMask> = {}): TextMask {
  return {
    id: 'm1',
    sourceImageId: 'img-1',
    textLayerId: 'el-1',
    polygon: [
      { x: 10, y: 10 },
      { x: 20, y: 10 },
      { x: 20, y: 20 },
      { x: 10, y: 20 },
    ],
    boundingBox: { x: 10, y: 10, width: 10, height: 10 },
    padding: 0,
    enabled: true,
    ...overrides,
  };
}

function solidImage(width: number, height: number, rgb: [number, number, number]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = rgb[0];
    data[i * 4 + 1] = rgb[1];
    data[i * 4 + 2] = rgb[2];
    data[i * 4 + 3] = 255;
  }
  return new ImageData(data, width, height);
}

describe('rasterizeMasks', () => {
  it('marks pixels inside the polygon (polygon-first region)', () => {
    const mask = rasterizeMasks([makeMask()], 40, 40);
    expect(mask[15 * 40 + 15]).toBe(1); // inside
    expect(mask[5 * 40 + 5]).toBe(0); // outside
    expect(mask[30 * 40 + 30]).toBe(0); // outside
  });

  it('skips disabled masks', () => {
    const mask = rasterizeMasks([makeMask({ enabled: false })], 40, 40);
    expect(mask[15 * 40 + 15]).toBe(0);
  });

  it('expands the region by padding', () => {
    const noPad = rasterizeMasks([makeMask()], 40, 40);
    const padded = rasterizeMasks([makeMask({ padding: 3 })], 40, 40);
    // pixel just outside the base region, but within padding
    expect(noPad[21 * 40 + 15]).toBe(0);
    expect(padded[21 * 40 + 15]).toBe(1);
  });

  it('handles a rotated (diamond) polygon', () => {
    const diamond: TextMask = {
      ...makeMask(),
      polygon: [
        { x: 20, y: 10 },
        { x: 30, y: 20 },
        { x: 20, y: 30 },
        { x: 10, y: 20 },
      ],
    };
    const mask = rasterizeMasks([diamond], 40, 40);
    expect(mask[20 * 40 + 20]).toBe(1); // center inside
    expect(mask[10 * 40 + 10]).toBe(0); // corner (outside diamond)
    expect(mask[30 * 40 + 10]).toBe(0); // corner (outside diamond)
  });
});

describe('inpaintImageData', () => {
  it('removes black text on white background (solid)', () => {
    const width = 40;
    const height = 40;
    const img = solidImage(width, height, [255, 255, 255]);
    const mask = new Uint8Array(width * height);
    // black horizontal stroke at y=20, x=10..30
    for (let x = 10; x <= 30; x++) {
      img.data[(20 * width + x) * 4] = 0;
      img.data[(20 * width + x) * 4 + 1] = 0;
      img.data[(20 * width + x) * 4 + 2] = 0;
      mask[20 * width + x] = 1;
    }
    const out = inpaintImageData(img, mask);
    let min = 255;
    for (let x = 10; x <= 30; x++) {
      min = Math.min(min, out.data[(20 * width + x) * 4]);
    }
    expect(min).toBeGreaterThanOrEqual(240);
  });

  it('removes white text on dark background', () => {
    const width = 40;
    const height = 40;
    const img = solidImage(width, height, [30, 30, 30]);
    const mask = new Uint8Array(width * height);
    for (let x = 10; x <= 30; x++) {
      img.data[(20 * width + x) * 4] = 255;
      img.data[(20 * width + x) * 4 + 1] = 255;
      img.data[(20 * width + x) * 4 + 2] = 255;
      mask[20 * width + x] = 1;
    }
    const out = inpaintImageData(img, mask);
    let max = 0;
    for (let x = 10; x <= 30; x++) {
      max = Math.max(max, out.data[(20 * width + x) * 4]);
    }
    expect(max).toBeLessThanOrEqual(45);
  });

  it('interpolates a gradient background', () => {
    const width = 40;
    const height = 40;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const v = x * 6;
        data[(y * width + x) * 4] = v;
        data[(y * width + x) * 4 + 1] = v;
        data[(y * width + x) * 4 + 2] = v;
        data[(y * width + x) * 4 + 3] = 255;
      }
    }
    const img = new ImageData(data, width, height);
    const mask = new Uint8Array(width * height);
    for (let x = 18; x <= 22; x++) {
      mask[20 * width + x] = 1;
      img.data[(20 * width + x) * 4] = 0;
    }
    const out = inpaintImageData(img, mask);
    // masked center pixel x=20 expects ~120 (20*6)
    const center = out.data[(20 * width + 20) * 4];
    expect(center).toBeGreaterThanOrEqual(110);
    expect(center).toBeLessThanOrEqual(130);
  });

  it('leaves unmasked pixels untouched', () => {
    const img = solidImage(20, 20, [128, 64, 32]);
    const mask = new Uint8Array(20 * 20); // empty mask
    const out = inpaintImageData(img, mask);
    expect(out.data[0]).toBe(128);
    expect(out.data[1]).toBe(64);
    expect(out.data[2]).toBe(32);
  });
});
