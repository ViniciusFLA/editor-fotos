import { describe, it, expect } from 'vitest';
import type { DetectedTextRegion, ImageElement, TextElement, TextMask } from '@/types';
import { useEditorStore } from '@/stores/editor-store';
import { isImageAlreadyProcessed } from './editable-text-pipeline';

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

function region(
  id: string,
  status: DetectedTextRegion['status'] = 'detected',
): DetectedTextRegion {
  return {
    id,
    sourceImageId: 'img-1',
    text: 'TXT',
    confidence: 0.9,
    polygon: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ],
    boundingBox: { x: 0, y: 0, width: 10, height: 10 },
    status,
  };
}

function mask(): TextMask {
  return {
    id: 'm1',
    sourceImageId: 'img-1',
    textLayerId: 't1',
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
}

function armedElement(): TextElement {
  return {
    id: 'armed-id',
    type: 'text',
    name: 'Text',
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
    text: 'TXT',
    fontFamily: 'Arial',
    fontSize: 20,
    fontWeight: 'normal',
    fontStyle: 'normal',
    textAlign: 'left',
    fill: '#000000',
    letterSpacing: 0,
    lineHeight: 1.2,
  };
}

function setupStore(img: ImageElement, extra: Record<string, unknown> = {}) {
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
    selectedElementIds: [],
    selectedDetectedRegionId: null,
    pendingEditRegionId: null,
    armedElement: null,
    armedRegionId: null,
    ocrStatus: 'idle' as const,
    ocrDetectedCount: 0,
    ocrError: null,
    ...extra,
  });
}

describe('CHECKPOINT 36.5G — clearDetections', () => {
  it('removes detectedTexts without touching src, masks or other elements', () => {
    const img = sourceImage({
      detectedTexts: [region('r1'), region('r2')],
      textMasks: [mask()],
    });
    setupStore(img);

    useEditorStore.getState().clearDetections('img-1');

    const updated = useEditorStore.getState().elements.find(
      (e) => e.id === 'img-1',
    ) as ImageElement;
    expect(updated.detectedTexts).toBeUndefined();
    expect(updated.src).toBe('data:image/png;base64,ORIG'); // raster unchanged
    expect(updated.textMasks).toEqual([mask()]); // masks unchanged
    expect(useEditorStore.getState().elements).toHaveLength(1); // no TextElements
  });

  it('resets armed state, selected region and OCR status', () => {
    const img = sourceImage({ detectedTexts: [region('r1', 'armed')] });
    setupStore(img, {
      armedElement: armedElement(),
      armedRegionId: 'r1',
      selectedDetectedRegionId: 'r1',
      pendingEditRegionId: 'r1',
      ocrStatus: 'success' as const,
      ocrDetectedCount: 3,
    });

    useEditorStore.getState().clearDetections('img-1');

    const s = useEditorStore.getState();
    expect(s.armedElement).toBeNull();
    expect(s.armedRegionId).toBeNull();
    expect(s.selectedDetectedRegionId).toBeNull();
    expect(s.pendingEditRegionId).toBeNull();
    expect(s.ocrStatus).toBe('idle');
    expect(s.ocrDetectedCount).toBe(0);
  });

  it('clears detection state even when no image carries detections', () => {
    setupStore(sourceImage(), {
      selectedDetectedRegionId: 'r1',
      ocrStatus: 'success' as const,
      ocrDetectedCount: 2,
    });

    useEditorStore.getState().clearDetections();

    const s = useEditorStore.getState();
    expect(s.ocrStatus).toBe('idle');
    expect(s.ocrDetectedCount).toBe(0);
    expect(s.selectedDetectedRegionId).toBeNull();
  });

  it('refuses to clear an image with a converted region (data protection)', () => {
    const img = sourceImage({
      detectedTexts: [region('r1', 'converted'), region('r2', 'detected')],
    });
    setupStore(img, {
      armedElement: armedElement(),
      armedRegionId: 'r1',
      selectedDetectedRegionId: 'r1',
      ocrStatus: 'success' as const,
    });

    useEditorStore.getState().clearDetections('img-1');

    const s = useEditorStore.getState();
    const updated = s.elements.find((e) => e.id === 'img-1') as ImageElement;
    expect(updated.detectedTexts).toHaveLength(2);
    expect(updated.detectedTexts![0]!.status).toBe('converted');
    // Transient state is left untouched as well.
    expect(s.armedElement).not.toBeNull();
    expect(s.selectedDetectedRegionId).toBe('r1');
    expect(s.ocrStatus).toBe('success');
  });

  it('refuses to clear an image with a transformed region (data protection)', () => {
    const img = sourceImage({ detectedTexts: [region('r1', 'transformed')] });
    setupStore(img, { armedRegionId: 'r1' });

    useEditorStore.getState().clearDetections('img-1');

    const updated = useEditorStore.getState().elements.find(
      (e) => e.id === 'img-1',
    ) as ImageElement;
    expect(updated.detectedTexts![0]!.status).toBe('transformed');
  });
});

describe('CHECKPOINT 36.5G — re-detect replaces detection state', () => {
  it('storeDetections replaces old regions (no duplicates, no stale ids)', () => {
    const img = sourceImage({ detectedTexts: [region('old1')] });
    setupStore(img);

    const fresh = [region('new1'), region('new2')];
    useEditorStore.getState().storeDetections('p1', 'img-1', fresh);

    const updated = useEditorStore.getState().elements.find(
      (e) => e.id === 'img-1',
    ) as ImageElement;
    expect(updated.detectedTexts).toEqual(fresh);
    expect(updated.detectedTexts).toHaveLength(2);
    expect(updated.detectedTexts!.some((r) => r.id === 'old1')).toBe(false);
    expect(updated.src).toBe('data:image/png;base64,ORIG'); // raster untouched
  });

  it('setOcrSuccess clears stale region selection (fresh regions invalidate ids)', () => {
    setupStore(sourceImage(), {
      ocrStatus: 'loading' as const,
      selectedDetectedRegionId: 'stale-r',
      pendingEditRegionId: 'stale-r',
    });

    useEditorStore.getState().setOcrSuccess(4);

    const s = useEditorStore.getState();
    expect(s.ocrStatus).toBe('success');
    expect(s.ocrDetectedCount).toBe(4);
    expect(s.selectedDetectedRegionId).toBeNull();
    expect(s.pendingEditRegionId).toBeNull();
  });
});

describe('CHECKPOINT 36.5G — converted-region protection', () => {
  it('isImageAlreadyProcessed blocks re-detection once any region is converted', () => {
    const processed = sourceImage({ originalSrc: 'data:image/png;base64,ORIG' });
    expect(isImageAlreadyProcessed(processed)).toBe(true);

    // Pure detection-only never sets originalSrc → re-detect stays allowed.
    const detectedOnly = sourceImage({ detectedTexts: [region('r1')] });
    expect(isImageAlreadyProcessed(detectedOnly)).toBe(false);
  });
});

describe('CHECKPOINT 36.5G — clearArmedRegion status protection', () => {
  it('resets an armed region back to detected', () => {
    const img = sourceImage({ detectedTexts: [region('r1', 'armed')] });
    setupStore(img, {
      armedElement: armedElement(),
      armedRegionId: 'r1',
    });

    useEditorStore.getState().clearArmedRegion();

    const updated = useEditorStore.getState().elements.find(
      (e) => e.id === 'img-1',
    ) as ImageElement;
    expect(updated.detectedTexts![0]!.status).toBe('detected');
    expect(useEditorStore.getState().armedElement).toBeNull();
  });

  it('does not reset a transformed region to detected', () => {
    const img = sourceImage({ detectedTexts: [region('r1', 'transformed')] });
    setupStore(img, {
      armedElement: armedElement(),
      armedRegionId: 'r1',
    });

    useEditorStore.getState().clearArmedRegion();

    const updated = useEditorStore.getState().elements.find(
      (e) => e.id === 'img-1',
    ) as ImageElement;
    expect(updated.detectedTexts![0]!.status).toBe('transformed');
  });

  it('does not reset a converted region to detected', () => {
    const img = sourceImage({ detectedTexts: [region('r1', 'converted')] });
    setupStore(img, {
      armedElement: armedElement(),
      armedRegionId: 'r1',
    });

    useEditorStore.getState().clearArmedRegion();

    const updated = useEditorStore.getState().elements.find(
      (e) => e.id === 'img-1',
    ) as ImageElement;
    expect(updated.detectedTexts![0]!.status).toBe('converted');
  });
});