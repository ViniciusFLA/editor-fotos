import { create } from 'zustand';
import type { AnyElement } from '@/types';

interface EditorStore {
  elements: AnyElement[];
  selectedElementIds: string[];
  pendingImageSrc: string | null;
  uploadError: string | null;
  triggeredTextAdd: number;

  setElements: (elements: AnyElement[]) => void;
  addElement: (element: AnyElement) => void;
  removeElement: (id: string) => void;
  updateElement: (id: string, updates: Partial<AnyElement>) => void;
  setSelectedElementIds: (ids: string[]) => void;
  setPendingImageSrc: (src: string | null) => void;
  setUploadError: (error: string | null) => void;
  triggerTextAdd: () => void;
}

export const useEditorStore = create<EditorStore>((set) => ({
  elements: [],
  selectedElementIds: [],
  pendingImageSrc: null,
  uploadError: null,
  triggeredTextAdd: 0,

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
}));
