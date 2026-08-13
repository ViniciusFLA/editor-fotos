import type { AnyElement, GroupElement, ImageElement } from '@/types';

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function deepCloneElement(el: AnyElement): AnyElement {
  switch (el.type) {
    case 'text':
      return { ...el };
    case 'image': {
      const img = el as ImageElement;
      return {
        ...img,
        filters: { ...img.filters },
        textMasks: img.textMasks ? img.textMasks.map((m) => ({ ...m })) : undefined,
      };
    }
    case 'shape':
      return { ...el };
    case 'group': {
      const group = el as GroupElement;
      return {
        ...group,
        childElements: group.childElements.map((child) => deepCloneElement(child)),
      };
    }
  }
}

export function deepCloneElementWithNewIds(el: AnyElement): AnyElement {
  const newId = generateId();

  switch (el.type) {
    case 'text':
      return { ...el, id: newId };
    case 'image': {
      const img = el as ImageElement;
      return {
        ...img,
        id: newId,
        assetId: generateId(),
        filters: { ...img.filters },
        textMasks: img.textMasks
          ? img.textMasks.map((m) => ({ ...m, sourceImageId: newId }))
          : undefined,
      };
    }
    case 'shape':
      return { ...el, id: newId };
    case 'group': {
      const group = el as GroupElement;
      return {
        ...group,
        id: newId,
        childElements: group.childElements.map((child) => deepCloneElementWithNewIds(child)),
      };
    }
  }
}
