import { create } from 'zustand';
import type { AnyElement } from '@/types';

interface EditorStore {
  elements: AnyElement[];
  selectedElementIds: string[];
  pendingImageSrc: string | null;
  uploadError: string | null;
  triggeredTextAdd: number;
  activeSidebarTab: string | null;

  setElements: (elements: AnyElement[]) => void;
  addElement: (element: AnyElement) => void;
  removeElement: (id: string) => void;
  updateElement: (id: string, updates: Partial<AnyElement>) => void;
  setSelectedElementIds: (ids: string[]) => void;
  setPendingImageSrc: (src: string | null) => void;
  setUploadError: (error: string | null) => void;
  triggerTextAdd: () => void;
  setActiveSidebarTab: (tab: string | null) => void;

  bringForward: (id: string) => void;
  sendBackward: (id: string) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  reorderElementsByZIndex: (orderedIds: string[]) => void;
}

function reorderZIndices(elements: AnyElement[], orderedIds: string[]): AnyElement[] {
  const idToZIndex = new Map<string, number>();
  orderedIds.forEach((id, i) => {
    idToZIndex.set(id, orderedIds.length - 1 - i);
  });

  return elements.map((el) => {
    const newZ = idToZIndex.get(el.id);
    if (newZ !== undefined) {
      return { ...el, zIndex: newZ } as AnyElement;
    }
    return el;
  });
}

export const useEditorStore = create<EditorStore>((set) => ({
  elements: [],
  selectedElementIds: [],
  pendingImageSrc: null,
  uploadError: null,
  triggeredTextAdd: 0,
  activeSidebarTab: null,

  setElements: (elements) => set({ elements }),

  addElement: (element) =>
    set((state) => ({ elements: [...state.elements, element] })),

  removeElement: (id) =>
    set((state) => ({
      elements: state.elements.filter((el) => el.id !== id),
      selectedElementIds: state.selectedElementIds.filter((sid) => sid !== id),
    })),

  updateElement: (id, updates) =>
    set((state) => ({
      elements: state.elements.map((el) =>
        el.id === id ? ({ ...el, ...updates } as AnyElement) : el,
      ),
    })),

  setSelectedElementIds: (ids) => set({ selectedElementIds: ids }),

  setPendingImageSrc: (src) => set({ pendingImageSrc: src }),

  setUploadError: (error) => set({ uploadError: error }),

  triggerTextAdd: () =>
    set((state) => ({ triggeredTextAdd: state.triggeredTextAdd + 1 })),

  setActiveSidebarTab: (tab) => set({ activeSidebarTab: tab }),

  bringForward: (id) =>
    set((state) => {
      const sorted = [...state.elements].sort((a, b) => a.zIndex - b.zIndex);
      const idx = sorted.findIndex((el) => el.id === id);
      if (idx < 0 || idx >= sorted.length - 1) return state;

      const current = sorted[idx]!;
      const next = sorted[idx + 1]!;

      return {
        elements: state.elements.map((el) => {
          if (el.id === current.id) return { ...el, zIndex: next.zIndex } as AnyElement;
          if (el.id === next.id) return { ...el, zIndex: current.zIndex } as AnyElement;
          return el;
        }),
      };
    }),

  sendBackward: (id) =>
    set((state) => {
      const sorted = [...state.elements].sort((a, b) => a.zIndex - b.zIndex);
      const idx = sorted.findIndex((el) => el.id === id);
      if (idx <= 0) return state;

      const current = sorted[idx]!;
      const prev = sorted[idx - 1]!;

      return {
        elements: state.elements.map((el) => {
          if (el.id === current.id) return { ...el, zIndex: prev.zIndex } as AnyElement;
          if (el.id === prev.id) return { ...el, zIndex: current.zIndex } as AnyElement;
          return el;
        }),
      };
    }),

  bringToFront: (id) =>
    set((state) => {
      const maxZ = Math.max(0, ...state.elements.map((el) => el.zIndex));

      return {
        elements: state.elements.map((el) =>
          el.id === id ? ({ ...el, zIndex: maxZ + 1 } as AnyElement) : el,
        ),
      };
    }),

  sendToBack: (id) =>
    set((state) => {
      const minZ = Math.min(0, ...state.elements.map((el) => el.zIndex));

      return {
        elements: state.elements.map((el) =>
          el.id === id ? ({ ...el, zIndex: minZ - 1 } as AnyElement) : el,
        ),
      };
    }),

  reorderElementsByZIndex: (orderedIds) =>
    set((state) => ({
      elements: reorderZIndices(state.elements, orderedIds),
    })),
}));
