import { describe, it, expect } from 'vitest';
import type { DetectedText } from '@/ai/types/ocr';
import type { DetectedTextRegion, ImageElement, TextElement } from '@/types';
import {
  estimateTextColor,
  DEFAULT_TEXT_COLOR,
} from '@/editor/ocr/text-style';
import {
  processDetections,
  convertArmedRegion,
  type InpaintFn,
} from './editable-text-pipeline';
import { convertDetectedTextsToTextElements } from '@/editor/ocr/ocr-to-elements';
import { useEditorStore } from '@/stores/editor-store';

const YELLOW = '#ffd400';

function detection(overrides: Partial<DetectedText> = {}): DetectedText {
  return {
    id: 'd1',
    text: '200%',
    boundingBox: { x: 10, y: 20, width: 120, height: 48 },
    confidence: 0.99,
    polygon: [
      { x: 10, y: 20 },
      { x: 130, y: 20 },
      { x: 130, y: 68 },
      { x: 10, y: 68 },
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

function yellowRegion(overrides: Partial<DetectedTextRegion> = {}): DetectedTextRegion {
  return {
    id: 'd1',
    sourceImageId: 'img-1',
    text: '200%',
    confidence: 0.99,
    polygon: [
      { x: 10, y: 20 },
      { x: 130, y: 20 },
      { x: 130, y: 68 },
      { x: 10, y: 68 },
    ],
    boundingBox: { x: 10, y: 20, width: 120, height: 48 },
    styleEstimate: { color: YELLOW, colorConfidence: 0.5 },
    status: 'detected',
    ...overrides,
  };
}

/** Replicates the armRegion snapshot construction. */
function armSnapshot(region: DetectedTextRegion, image: ImageElement): TextElement {
  const detected: DetectedText = {
    id: region.id,
    text: region.text,
    confidence: region.confidence,
    polygon: region.polygon.length >= 3 ? region.polygon : undefined,
    boundingBox: region.boundingBox,
  };
  const [base] = convertDetectedTextsToTextElements({
    result: { detectedTexts: [detected] },
    sourceImage: image,
    sourcePageId: 'p1',
    baseZIndex: 5,
    minConfidence: 0,
  });
  if (region.styleEstimate?.color) base!.fill = region.styleEstimate.color;
  return base!;
}

const mockInpaint: InpaintFn = async () => ({
  src: 'data:image/png;base64,MASKED',
  width: 1000,
  height: 1000,
});

function resetStore() {
  const img = sourceImage({
    detectedTexts: [yellowRegion()],
  });
  useEditorStore.setState({
    pages: [
      {
        id: 'p1',
        name: 'p1',
        pageNumber: 1,
        width: 1080,
        height: 1080,
        background: { type: 'color', color: '#fff', src: '', assetId: '', gradientStops: [], direction: 0 },
        elements: [img],
      },
    ],
    activePageId: 'p1',
    elements: [img],
    armedElement: null,
    armedRegionId: null,
    armedTextualEditVersion: 0,
  });
}

describe('CHECKPOINT 36.5F — color preservation', () => {
  it('A. yellow 200% → fontSize change stays yellow', async () => {
    const img = sourceImage();
    const region = yellowRegion();
    const base = armSnapshot(region, img);
    useEditorStore.getState().setArmedRegion(base, region.id);

    useEditorStore.getState().applyArmedTextualEdit({ fontSize: 70 });

    const armed = useEditorStore.getState().armedElement!;
    expect(armed.fontSize).toBe(70);
    expect(armed.fill).toBe(YELLOW);
    expect(armed.text).toBe('200%');

    const result = await convertArmedRegion({
      region,
      sourceImage: img,
      element: armed,
      existingMasks: [],
      config: { inpaint: mockInpaint },
    });
    expect(result.element.fill).toBe(YELLOW);
    expect(result.element.fontSize).toBe(70);
  });

  it('B. yellow 200% → content 200% → 150% stays yellow', async () => {
    const img = sourceImage();
    const region = yellowRegion();
    const base = armSnapshot(region, img);
    useEditorStore.getState().setArmedRegion(base, region.id);

    useEditorStore.getState().applyArmedTextualEdit({ text: '150%' });

    const armed = useEditorStore.getState().armedElement!;
    expect(armed.text).toBe('150%');
    expect(armed.fill).toBe(YELLOW);

    const result = await convertArmedRegion({
      region,
      sourceImage: img,
      element: armed,
      existingMasks: [],
      config: { inpaint: mockInpaint },
    });
    expect(result.element.fill).toBe(YELLOW);
    expect(result.element.text).toBe('150%');
  });

  it('C. yellow 200% → move proxy stays yellow and does not convert', async () => {
    resetStore();
    const base = armSnapshot(yellowRegion(), sourceImage());
    useEditorStore.getState().setArmedRegion(base, 'd1');

    useEditorStore.getState().updateArmedElement({ x: 420, y: 500 });

    const state = useEditorStore.getState();
    expect(state.armedElement!.fill).toBe(YELLOW);
    expect(state.armedElement!.x).toBe(420);
    expect(state.armedElement!.y).toBe(500);
    // Spatial edit must NOT trigger a conversion.
    expect(state.armedTextualEditVersion).toBe(0);
  });

  it('D. yellow 200% → resize proxy stays yellow and does not convert', () => {
    resetStore();
    const base = armSnapshot(yellowRegion(), sourceImage());
    useEditorStore.getState().setArmedRegion(base, 'd1');

    useEditorStore.getState().updateArmedElement({ width: 300, height: 120 });

    const state = useEditorStore.getState();
    expect(state.armedElement!.fill).toBe(YELLOW);
    expect(state.armedElement!.width).toBe(300);
    expect(state.armedTextualEditVersion).toBe(0);
  });

  it('E. yellow 200% → rotate proxy stays yellow and does not convert', () => {
    resetStore();
    const base = armSnapshot(yellowRegion(), sourceImage());
    useEditorStore.getState().setArmedRegion(base, 'd1');

    useEditorStore.getState().updateArmedElement({ rotation: 15 });

    const state = useEditorStore.getState();
    expect(state.armedElement!.fill).toBe(YELLOW);
    expect(state.armedElement!.rotation).toBe(15);
    expect(state.armedTextualEditVersion).toBe(0);
  });

  it('F. explicit color change yellow → red becomes red', async () => {
    const img = sourceImage();
    const region = yellowRegion();
    const base = armSnapshot(region, img);
    useEditorStore.getState().setArmedRegion(base, region.id);

    useEditorStore.getState().applyArmedTextualEdit({ fill: '#ff0000' });

    const armed = useEditorStore.getState().armedElement!;
    expect(armed.fill).toBe('#ff0000');

    const result = await convertArmedRegion({
      region,
      sourceImage: img,
      element: armed,
      existingMasks: [],
      config: { inpaint: mockInpaint },
    });
    expect(result.element.fill).toBe('#ff0000');
  });

  it('spatial proxy transform persists without creating an IText (commitProxyTransform)', () => {
    resetStore();
    const base = armSnapshot(yellowRegion(), sourceImage());
    useEditorStore.getState().setArmedRegion(base, 'd1');

    useEditorStore.getState().commitProxyTransform('p1', 'img-1', {
      masks: [],
      maskedImageSrc: 'data:image/png;base64,MASKED',
      originalSrc: 'data:image/png;base64,ORIG',
      regionId: 'd1',
      transform: { x: 420, y: 500, scaleX: 0.7, scaleY: 0.7, rotation: 0 },
    });

    const state = useEditorStore.getState();
    // No new text layer was added — the proxy stays raster.
    expect(state.elements.every((e) => e.type !== 'text')).toBe(true);
    const img = state.elements.find((e) => e.id === 'img-1') as ImageElement;
    const region = img.detectedTexts!.find((r) => r.id === 'd1')!;
    expect(region.status).toBe('transformed');
    expect(region.proxyTransform?.x).toBe(420);
    // Armed element fill is untouched.
    expect(state.armedElement!.fill).toBe(YELLOW);
  });
});

describe('CHECKPOINT 36.5F — color trace (yellow 200% on dark blue)', () => {
  it('records the full color path without ever hitting #000000', async () => {
    // 1. Real color estimation over a synthetic "yellow 200% on dark blue".
    const width = 120;
    const height = 50;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      data[i * 4] = 20;
      data[i * 4 + 1] = 20;
      data[i * 4 + 2] = 80;
      data[i * 4 + 3] = 255;
    }
    const main = [255, 212, 0];
    const edge = [200, 165, 40];
    for (let x = 20; x < 100; x++) {
      const mod = x % 10;
      if (mod >= 3) continue;
      const c = mod === 0 ? edge : main;
      for (let y = 12; y < 36; y++) {
        const i = (y * width + x) * 4;
        data[i] = c[0]!;
        data[i + 1] = c[1]!;
        data[i + 2] = c[2]!;
      }
    }
    const imageData = new ImageData(data, width, height);
    const estimated = estimateTextColor(imageData, {
      x: 10,
      y: 5,
      width: 100,
      height: 40,
    });

    const estimatedColor = estimated.color;
    const confidence = estimated.confidence;

    // 2. Detection stores the estimated color (even at low confidence).
    const detections = await processDetections({
      sourceImage: sourceImage(),
      ocrResult: { detectedTexts: [detection()] },
      sourcePageId: 'p1',
      config: {
        estimateStyles: async () => [{ color: estimatedColor, confidence }],
      },
    });
    const region = detections.regions[0]!;

    // 3. Arm snapshot.
    const img = sourceImage();
    const base = armSnapshot(region, img);
    const armedFill = base.fill;

    useEditorStore.getState().setArmedRegion(base, region.id);
    const rightPanelFill = useEditorStore.getState().armedElement!.fill;

    // 4. User patch — only fontSize.
    const userPatch = { fontSize: 70 };
    useEditorStore.getState().applyArmedTextualEdit(userPatch);

    // 5. Final element.
    const finalElement = useEditorStore.getState().armedElement!;

    // 6. Fabric IText.fill maps 1:1 from element.fill.
    const fabricFill = finalElement.fill;

    console.log('[color-trace] estimated color:', estimatedColor);
    console.log('[color-trace] color confidence:', confidence);
    console.log('[color-trace] armedElement.fill:', armedFill);
    console.log('[color-trace] RightPanel fill:', rightPanelFill);
    console.log('[color-trace] user patch:', JSON.stringify(userPatch));
    console.log('[color-trace] final TextElement.fill:', finalElement.fill);
    console.log('[color-trace] Fabric IText.fill:', fabricFill);

    // Assertions: the color path never resolves to black.
    expect(estimatedColor).not.toBe(DEFAULT_TEXT_COLOR);
    expect(armedFill).not.toBe(DEFAULT_TEXT_COLOR);
    expect(rightPanelFill).not.toBe(DEFAULT_TEXT_COLOR);
    expect(finalElement.fill).not.toBe(DEFAULT_TEXT_COLOR);
    expect(finalElement.fill).toBe(armedFill);
    expect(finalElement.fontSize).toBe(70);
    expect(finalElement.text).toBe('200%');
  });
});
