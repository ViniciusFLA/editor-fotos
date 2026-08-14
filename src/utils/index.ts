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
        detectedTexts: img.detectedTexts
          ? img.detectedTexts.map((r) => ({
              ...r,
              styleEstimate: r.styleEstimate ? { ...r.styleEstimate } : undefined,
            }))
          : undefined,
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

/**
 * Clone a set of elements with brand-new ids, remapping every internal
 * relationship (ETAPA 36.3 — clone relationship integrity).
 *
 * `ImageElement.textMasks` reference `sourceImageId` and `textLayerId`. When a
 * whole set (e.g. a page) is duplicated, each reference must be remapped to the
 * new ids. When a referenced element is NOT part of the set (e.g. duplicating a
 * single OCR image without its text layer), the dangling `textLayerId` is
 * cleared to `''` so no cross-element references are created.
 */
export function cloneElementsWithNewIds(elements: AnyElement[]): AnyElement[] {
  const idMap = new Map<string, string>();

  const collectIds = (el: AnyElement): void => {
    idMap.set(el.id, generateId());
    if (el.type === 'group') {
      (el as GroupElement).childElements.forEach(collectIds);
    }
  };
  elements.forEach(collectIds);

  const clone = (el: AnyElement): AnyElement => {
    const newId = idMap.get(el.id)!;
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
            ? img.textMasks.map((m) => ({
                ...m,
                id: generateId(),
                sourceImageId: newId,
                textLayerId: idMap.get(m.textLayerId) ?? '',
              }))
            : undefined,
          detectedTexts: img.detectedTexts
            ? img.detectedTexts.map((r) => ({
                ...r,
                id: generateId(),
                sourceImageId: newId,
                textLayerId: r.textLayerId ? (idMap.get(r.textLayerId) ?? '') : undefined,
                styleEstimate: r.styleEstimate ? { ...r.styleEstimate } : undefined,
              }))
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
          childElements: group.childElements.map(clone),
        };
      }
    }
  };

  return elements.map(clone);
}

/**
 * Clone a single element with a new id.
 *
 * Delegates to `cloneElementsWithNewIds` so that an image cloned without its
 * linked text layer gets a cleared (orphaned) `textLayerId` instead of a
 * dangling reference to an element that was not cloned.
 */
export function deepCloneElementWithNewIds(el: AnyElement): AnyElement {
  return cloneElementsWithNewIds([el])[0]!;
}
