import { describe, it, expect } from 'vitest';
import type { ImageElement } from '@/types';
import {
  computeImageFitScale,
  captureImageGeometry,
  DEFAULT_MAX_DIMENSION_RATIO,
} from './image-fit';

describe('computeImageFitScale (ETAPA 36.2B — single fit rule)', () => {
  it('fits a square image proportionally into the available box', () => {
    const scale = computeImageFitScale({
      naturalWidth: 1080,
      naturalHeight: 1080,
      availableWidth: 756,
      availableHeight: 756,
    });
    expect(scale).toBeCloseTo(0.7, 5);
  });

  it('fits a portrait image (1080x1920) by height without stretching', () => {
    const scale = computeImageFitScale({
      naturalWidth: 1080,
      naturalHeight: 1920,
      availableWidth: 756,
      availableHeight: 756,
    });
    expect(scale).toBeCloseTo(756 / 1920, 5);
    expect(scale).toBeLessThan(756 / 1080);
  });

  it('fits a landscape image (1920x1080) by width without stretching', () => {
    const scale = computeImageFitScale({
      naturalWidth: 1920,
      naturalHeight: 1080,
      availableWidth: 756,
      availableHeight: 756,
    });
    expect(scale).toBeCloseTo(756 / 1920, 5);
    expect(scale).toBeLessThan(756 / 1080);
  });

  it('fits a wide banner (1200x628)', () => {
    const scale = computeImageFitScale({
      naturalWidth: 1200,
      naturalHeight: 628,
      availableWidth: 756,
      availableHeight: 756,
    });
    expect(scale).toBeCloseTo(756 / 1200, 5);
  });

  it('does not upscale a small image beyond 1x (500x500)', () => {
    const scale = computeImageFitScale({
      naturalWidth: 500,
      naturalHeight: 500,
      availableWidth: 756,
      availableHeight: 756,
    });
    expect(scale).toBe(1);
  });

  it('preserves aspect ratio (single scale for both axes)', () => {
    const scale = computeImageFitScale({
      naturalWidth: 1080,
      naturalHeight: 1350,
      availableWidth: 756,
      availableHeight: 756,
    });
    // same scale applied to both axes => displayed ratio equals natural ratio
    const displayW = 1080 * scale;
    const displayH = 1350 * scale;
    expect(displayW / displayH).toBeCloseTo(1080 / 1350, 5);
  });

  it('caps at the configured max ratio', () => {
    const scale = computeImageFitScale({
      naturalWidth: 1080,
      naturalHeight: 1080,
      availableWidth: 756,
      availableHeight: 756,
      maxRatio: 0.5,
    });
    expect(scale).toBe(0.5);
  });

  it('defaults the max dimension ratio to 0.7', () => {
    expect(DEFAULT_MAX_DIMENSION_RATIO).toBe(0.7);
  });
});

describe('captureImageGeometry (ETAPA 36.2B — geometry invariant)', () => {
  function image(overrides: Partial<ImageElement> = {}): ImageElement {
    return {
      id: 'img-1',
      type: 'image',
      name: 'Imagem',
      x: 162,
      y: 162,
      width: 1080,
      height: 1080,
      scaleX: 0.7,
      scaleY: 0.7,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      zIndex: 1,
      assetId: 'a1',
      src: 'data:image/png;base64,AAA',
      cropX: 0,
      cropY: 0,
      cropWidth: 1080,
      cropHeight: 1080,
      flipX: false,
      flipY: false,
      filters: {
        brightness: 0,
        contrast: 0,
        saturation: 0,
        blur: 0,
        grayscale: false,
      },
      naturalWidth: 1080,
      naturalHeight: 1080,
      ...overrides,
    };
  }

  it('captures the full invariant geometry', () => {
    const g = captureImageGeometry(image());
    expect(g).toEqual({
      x: 162,
      y: 162,
      width: 1080,
      height: 1080,
      scaleX: 0.7,
      scaleY: 0.7,
      rotation: 0,
      cropX: 0,
      cropY: 0,
      flipX: false,
      flipY: false,
    });
  });

  it('produces the same snapshot for identical images', () => {
    expect(captureImageGeometry(image())).toEqual(captureImageGeometry(image()));
  });

  it('detects a changed scale', () => {
    expect(captureImageGeometry(image({ scaleX: 1, scaleY: 1 }))).not.toEqual(
      captureImageGeometry(image()),
    );
  });
});
