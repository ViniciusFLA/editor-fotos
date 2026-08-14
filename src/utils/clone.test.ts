import { describe, it, expect } from 'vitest';
import type { AnyElement, ImageElement, TextElement, TextMask, PageData, PageBackground } from '@/types';
import {
  cloneElementsWithNewIds,
  deepCloneElementWithNewIds,
  deepCloneElement,
} from './index';
import { useEditorStore } from '@/stores/editor-store';

function textMask(overrides: Partial<TextMask> = {}): TextMask {
  return {
    id: 'mask-1',
    sourceImageId: 'img-1',
    textLayerId: 'text-1',
    polygon: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ],
    boundingBox: { x: 0, y: 0, width: 10, height: 10 },
    padding: 3,
    enabled: true,
    ...overrides,
  };
}

function image(overrides: Partial<ImageElement> = {}): ImageElement {
  return {
    id: 'img-1',
    type: 'image',
    name: 'Imagem',
    x: 0,
    y: 0,
    width: 1080,
    height: 1080,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    zIndex: 1,
    assetId: 'asset-1',
    src: 'data:image/png;base64,AAA',
    cropX: 0,
    cropY: 0,
    cropWidth: 1080,
    cropHeight: 1080,
    flipX: false,
    flipY: false,
    filters: { brightness: 0, contrast: 0, saturation: 0, blur: 0, grayscale: false },
    naturalWidth: 1080,
    naturalHeight: 1080,
    ...overrides,
  };
}

function text(overrides: Partial<TextElement> = {}): TextElement {
  return {
    id: 'text-1',
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
    zIndex: 2,
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

function page(id: string, elements: AnyElement[] = []): PageData {
  const background: PageBackground = {
    type: 'color',
    color: '#ffffff',
    src: '',
    assetId: '',
    gradientStops: [],
    direction: 0,
  };
  return { id, name: id, pageNumber: 1, width: 1080, height: 1080, background, elements };
}

describe('cloneElementsWithNewIds (ETAPA 36.3 — clone relationship integrity)', () => {
  it('regenerates ids for every element and remaps mask references', () => {
    const img = image({ textMasks: [textMask({ sourceImageId: 'img-1', textLayerId: 'text-1' })] });
    const txt = text({ id: 'text-1' });

    const cloned = cloneElementsWithNewIds([img, txt]);

    const newImg = cloned.find((e) => e.type === 'image') as ImageElement;
    const newText = cloned.find((e) => e.type === 'text') as TextElement;

    expect(newImg.id).not.toBe('img-1');
    expect(newText.id).not.toBe('text-1');
    expect(newImg.id).not.toBe(newText.id);

    const mask = newImg.textMasks![0]!;
    expect(mask.sourceImageId).toBe(newImg.id);
    expect(mask.textLayerId).toBe(newText.id);
    expect(mask.id).not.toBe('mask-1');
  });

  it('leaves no references to the original page', () => {
    const img = image({ textMasks: [textMask({ sourceImageId: 'img-1', textLayerId: 'text-1' })] });
    const txt = text({ id: 'text-1' });

    const cloned = cloneElementsWithNewIds([img, txt]);
    const newImg = cloned.find((e) => e.type === 'image') as ImageElement;
    const mask = newImg.textMasks![0]!;

    const allIds = cloned.map((e) => e.id);
    expect(allIds).not.toContain('img-1');
    expect(allIds).not.toContain('text-1');
    expect(mask.sourceImageId).not.toBe('img-1');
    expect(mask.textLayerId).not.toBe('text-1');
  });

  it('clears dangling textLayerId when duplicating an image alone', () => {
    const img = image({ textMasks: [textMask({ sourceImageId: 'img-1', textLayerId: 'text-1' })] });
    const cloned = deepCloneElementWithNewIds(img) as ImageElement;

    expect(cloned.id).not.toBe('img-1');
    expect(cloned.textMasks![0]!.sourceImageId).toBe(cloned.id);
    expect(cloned.textMasks![0]!.textLayerId).toBe('');
  });

  it('remaps ids inside groups', () => {
    const img = image({ id: 'img-inner', textMasks: [textMask({ sourceImageId: 'img-inner', textLayerId: 'text-inner' })] });
    const txt = text({ id: 'text-inner' });
    const group: AnyElement = {
      id: 'group-1',
      type: 'group',
      name: 'Group',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      zIndex: 3,
      childElements: [img, txt],
    };

    const cloned = cloneElementsWithNewIds([group])[0] as AnyElement;
    expect(cloned.id).not.toBe('group-1');

    const groupClone = cloned as { childElements: AnyElement[] };
    const innerImg = groupClone.childElements.find((e) => e.type === 'image') as ImageElement;
    const innerText = groupClone.childElements.find((e) => e.type === 'text') as TextElement;

    expect(innerImg.id).not.toBe('img-inner');
    expect(innerText.id).not.toBe('text-inner');
    expect(innerImg.textMasks![0]!.sourceImageId).toBe(innerImg.id);
    expect(innerImg.textMasks![0]!.textLayerId).toBe(innerText.id);
  });

  it('deepCloneElement preserves references (no new ids)', () => {
    const img = image({ textMasks: [textMask({ sourceImageId: 'img-1', textLayerId: 'text-1' })] });
    const clone = deepCloneElement(img) as ImageElement;
    expect(clone.id).toBe('img-1');
    expect(clone.textMasks![0]!.textLayerId).toBe('text-1');
  });
});

describe('duplicatePage relationship integrity (store)', () => {
  it('remaps mask references in the duplicated page', () => {
    const img = image({ id: 'img-1', textMasks: [textMask({ sourceImageId: 'img-1', textLayerId: 'text-1' })] });
    const txt = text({ id: 'text-1' });

    useEditorStore.setState({
      pages: [page('p1', [img, txt])],
      activePageId: 'p1',
      elements: [img, txt],
      nextPageNumber: 2,
    });

    useEditorStore.getState().duplicatePage('p1');

    const state = useEditorStore.getState();
    expect(state.pages).toHaveLength(2);

    const newPage = state.pages.find((p) => p.id !== 'p1')!;
    const newImg = newPage.elements.find((e) => e.type === 'image') as ImageElement;
    const newText = newPage.elements.find((e) => e.type === 'text') as TextElement;

    expect(newImg.id).not.toBe('img-1');
    expect(newText.id).not.toBe('text-1');
    expect(newImg.textMasks![0]!.sourceImageId).toBe(newImg.id);
    expect(newImg.textMasks![0]!.textLayerId).toBe(newText.id);

    // Original page remains intact (delete isolation foundation).
    const originalPage = state.pages.find((p) => p.id === 'p1')!;
    const origImg = originalPage.elements.find((e) => e.type === 'image') as ImageElement;
    expect(origImg.id).toBe('img-1');
    expect(origImg.textMasks![0]!.textLayerId).toBe('text-1');
  });
});
