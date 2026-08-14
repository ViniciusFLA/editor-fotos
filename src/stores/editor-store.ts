import { create } from 'zustand';
import type { AnyElement, DetectedTextRegion, GroupElement, ImageElement, PageBackground, PageData, TextElement, TextMask } from '@/types';
import type { ShapeType } from '@/types';
import { generateId, deepCloneElement, cloneElementsWithNewIds } from '@/utils';
import { saveProjectData, loadProjectData, getLastProjectId } from '@/lib/persistence';
import { serializeProject } from '@/lib/project-serializer';
import { clearHistory } from '@/editor/history/history-manager';

const ZOOM_MIN = 0.1;
const ZOOM_MAX = 4.0;

const ZOOM_STEPS = [0.1, 0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0, 4.0];

function clampZoom(z: number): number {
  return Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z)) * 100) / 100;
}

function nextZoomStep(current: number): number {
  const step = ZOOM_STEPS.find((s) => s > current);
  return step ?? ZOOM_MAX;
}

function prevZoomStep(current: number): number {
  const reversed = [...ZOOM_STEPS].reverse();
  const step = reversed.find((s) => s < current);
  return step ?? ZOOM_MIN;
}

interface EditorStore {
  elements: AnyElement[];
  selectedElementIds: string[];
  pendingImageSrc: string | null;
  uploadError: string | null;
  triggeredTextAdd: number;
  activeSidebarTab: string | null;
  clipboard: AnyElement[];
  pasteOffset: number;
  rebuildCanvasVersion: number;
  triggeredUndo: number;
  triggeredRedo: number;
  zoom: number;
  triggeredShapeAdd: number;
  pendingShapeType: ShapeType | null;
  triggeredGroup: number;
  triggeredUngroup: number;
  cropModeElementId: string | null;
  cropModeSnapshot: Pick<ImageElement, 'cropX' | 'cropY' | 'width' | 'height'> | null;
  fontReloadVersion: number;
  pageBackground: PageBackground;
  pages: PageData[];
  activePageId: string;
  projectId: string;
  projectName: string;
  createdAt: string;
  saveStatus: 'saved' | 'unsaved' | 'saving' | 'error';
  triggeredExport: number;
  exportFormat: 'png' | 'jpeg' | 'webp';
  exportScale: number;
  nextPageNumber: number;
  ocrStatus: 'idle' | 'loading' | 'success' | 'error';
  ocrDetectedCount: number;
  ocrError: string | null;
  triggeredOcr: number;
  selectedDetectedRegionId: string | null;
  triggeredEditRegion: number;
  pendingEditRegionId: string | null;
  triggeredConvertAll: number;
  triggeredClearDetections: number;
  armedElement: TextElement | null;
  armedRegionId: string | null;
  armedTextualEditVersion: number;

  setElements: (elements: AnyElement[]) => void;
  addElement: (element: AnyElement) => void;
  addElements: (elements: AnyElement[]) => void;
  addElementsToPage: (pageId: string, elements: AnyElement[]) => void;
  commitEditableTextResult: (
    pageId: string,
    imageId: string,
    updates: {
      maskedImageSrc: string | null;
      masks: TextMask[];
      elements: TextElement[];
      originalSrc: string;
    },
  ) => void;
  removeElement: (id: string) => void;
  updateElement: (id: string, updates: Partial<AnyElement>) => void;
  updateElementInPage: (pageId: string, id: string, updates: Partial<AnyElement>) => void;
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

  copyToClipboard: () => void;
  incrementPasteOffset: () => void;
  triggerRebuildCanvas: () => void;
  triggerUndo: () => void;
  triggerRedo: () => void;

  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomReset: () => void;

  triggerShapeAdd: (shapeType: ShapeType) => void;

  groupSelected: (group: GroupElement, childIds: string[]) => void;
  ungroupSelected: (groupId: string, children: AnyElement[]) => void;

  triggerGroup: () => void;
  triggerUngroup: () => void;

  setCropMode: (elementId: string | null, snapshot?: Pick<ImageElement, 'cropX' | 'cropY' | 'width' | 'height'>) => void;
  triggerFontReload: () => void;
  setPageBackground: (bg: PageBackground) => void;

  setActivePage: (id: string) => void;
  createPage: (width?: number, height?: number, namePrefix?: string) => void;
  deletePage: (id: string) => void;
  duplicatePage: (id: string) => void;
  renamePage: (id: string, name: string) => void;

  setProjectName: (name: string) => void;
  saveProject: () => Promise<void>;
  loadProject: (id: string) => Promise<void>;
  newProject: () => void;
  markUnsaved: () => void;

  triggerExport: (format: 'png' | 'jpeg' | 'webp', scale: number) => void;

  triggerOcrDetect: () => void;
  setOcrLoading: () => void;
  setOcrSuccess: (count: number) => void;
  setOcrError: (message: string) => void;
  setOcrIdle: () => void;

  setSelectedDetectedRegionId: (id: string | null) => void;
  storeDetections: (pageId: string, imageId: string, regions: DetectedTextRegion[]) => void;
  triggerEditRegion: (regionId: string) => void;
  triggerConvertAll: () => void;
  triggerClearDetections: () => void;
  clearDetections: (imageId?: string) => void;
  commitRegionConversion: (
    pageId: string,
    imageId: string,
    updates: {
      maskedImageSrc: string | null;
      masks: TextMask[];
      elements: TextElement[];
      originalSrc: string;
      convertedRegionIds: string[];
    },
  ) => void;
  setArmedRegion: (element: TextElement, regionId: string) => void;
  updateArmedElement: (updates: Partial<TextElement>) => void;
  applyArmedTextualEdit: (updates: Partial<TextElement>) => void;
  clearArmedRegion: () => void;
  commitArmedConversion: (
    pageId: string,
    imageId: string,
    updates: {
      element: TextElement;
      masks: TextMask[];
      maskedImageSrc: string;
      originalSrc: string;
      regionId: string;
    },
  ) => void;
  commitProxyTransform: (
    pageId: string,
    imageId: string,
    updates: {
      masks: TextMask[];
      maskedImageSrc: string;
      originalSrc: string;
      regionId: string;
      transform: { x: number; y: number; scaleX: number; scaleY: number; rotation: number };
    },
  ) => void;
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

function revokeBlobUrls(elements: AnyElement[]): void {
  for (const el of elements) {
    if (el.type === 'image') {
      const src = (el as ImageElement).src;
      if (src.startsWith('blob:')) {
        URL.revokeObjectURL(src);
      }
    } else if (el.type === 'group') {
      revokeBlobUrls((el as GroupElement).childElements);
    }
  }
}

interface PageSyncState {
  pages: PageData[];
  activePageId: string;
}

function withPageSync(
  state: PageSyncState,
  newElements: AnyElement[],
  extra?: Partial<EditorStore>,
): Partial<EditorStore> {
  return {
    elements: newElements,
    pages: state.pages.map((p) =>
      p.id === state.activePageId ? { ...p, elements: newElements } : p,
    ),
    ...(extra ?? {}),
  };
}

export const useEditorStore = create<EditorStore>((set) => ({
  elements: [],
  selectedElementIds: [],
  pendingImageSrc: null,
  uploadError: null,
  triggeredTextAdd: 0,
  activeSidebarTab: null,
  clipboard: [],
  pasteOffset: 0,
  rebuildCanvasVersion: 0,
  triggeredUndo: 0,
  triggeredRedo: 0,
  zoom: 1,
  triggeredShapeAdd: 0,
  pendingShapeType: null,
  triggeredGroup: 0,
  triggeredUngroup: 0,
  cropModeElementId: null,
  cropModeSnapshot: null,
  fontReloadVersion: 0,
  pageBackground: {
    type: 'color',
    color: '#ffffff',
    src: '',
    assetId: '',
    gradientStops: [
      { offset: 0, color: '#ffffff' },
      { offset: 1, color: '#cccccc' },
    ],
    direction: 0,
  },
  pages: [
    {
      id: 'page-1',
      name: 'Page 1',
      pageNumber: 1,
      width: 1080,
      height: 1080,
      background: {
        type: 'color',
        color: '#ffffff',
        src: '',
        assetId: '',
        gradientStops: [
          { offset: 0, color: '#ffffff' },
          { offset: 1, color: '#cccccc' },
        ],
        direction: 0,
      },
      elements: [],
    },
  ],
  activePageId: 'page-1',
  projectId: getLastProjectId() || generateId(),
  projectName: 'Untitled Project',
  createdAt: new Date().toISOString(),
  saveStatus: 'saved',
  triggeredExport: 0,
  exportFormat: 'png' as const,
  exportScale: 1,
  nextPageNumber: 2,
  ocrStatus: 'idle' as const,
  ocrDetectedCount: 0,
  ocrError: null,
  triggeredOcr: 0,
  selectedDetectedRegionId: null,
  triggeredEditRegion: 0,
  pendingEditRegionId: null,
  triggeredConvertAll: 0,
  triggeredClearDetections: 0,
  armedElement: null,
  armedRegionId: null,
  armedTextualEditVersion: 0,

  setElements: (elements) =>
    set((state) => ({
      elements,
      pages: state.pages.map((p) =>
        p.id === state.activePageId ? { ...p, elements } : p,
      ),
    })),

  addElement: (element) =>
    set((state) => withPageSync(state, [...state.elements, element])),

  addElements: (elements) =>
    set((state) =>
      withPageSync(state, [...state.elements, ...elements]),
    ),

  addElementsToPage: (pageId, elements) =>
    set((state) => {
      const isActive = state.activePageId === pageId;
      return {
        elements: isActive
          ? [...state.elements, ...elements]
          : state.elements,
        pages: state.pages.map((p) =>
          p.id === pageId
            ? { ...p, elements: [...p.elements, ...elements] }
            : p,
        ),
      };
    }),

  removeElement: (id) =>
    set((state) => {
      const removed = state.elements.find((el) => el.id === id);
      if (removed) {
        revokeBlobUrls([removed]);
      }
      return withPageSync(state, state.elements.filter((el) => el.id !== id), {
        selectedElementIds: state.selectedElementIds.filter((sid) => sid !== id),
      });
    }),

  updateElement: (id, updates) =>
    set((state) =>
      withPageSync(
        state,
        state.elements.map((el) =>
          el.id === id ? ({ ...el, ...updates } as AnyElement) : el,
        ),
      ),
    ),

  updateElementInPage: (pageId, id, updates) =>
    set((state) => {
      const isActive = state.activePageId === pageId;
      return {
        elements: isActive
          ? state.elements.map((el) =>
              el.id === id ? ({ ...el, ...updates } as AnyElement) : el,
            )
          : state.elements,
        pages: state.pages.map((p) =>
          p.id === pageId
            ? {
                ...p,
                elements: p.elements.map((el) =>
                  el.id === id ? ({ ...el, ...updates } as AnyElement) : el,
                ),
              }
            : p,
        ),
      };
    }),

  commitEditableTextResult: (pageId, imageId, updates) =>
    set((state) => {
      const isActive = state.activePageId === pageId;

      const applyToElements = (els: AnyElement[]): AnyElement[] =>
        els.map((el) => {
          if (el.id !== imageId) return el;
          const img = el as ImageElement;
          return {
            ...img,
            src: updates.maskedImageSrc ?? img.src,
            originalSrc: updates.originalSrc,
            textMasks: updates.masks,
          } as ImageElement;
        });

      return {
        elements: isActive
          ? [...applyToElements(state.elements), ...updates.elements]
          : state.elements,
        pages: state.pages.map((p) =>
          p.id === pageId
            ? { ...p, elements: [...applyToElements(p.elements), ...updates.elements] }
            : p,
        ),
      };
    }),

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

      const newElements = state.elements.map((el) => {
        if (el.id === current.id) return { ...el, zIndex: next.zIndex } as AnyElement;
        if (el.id === next.id) return { ...el, zIndex: current.zIndex } as AnyElement;
        return el;
      });

      return withPageSync(state, newElements);
    }),

  sendBackward: (id) =>
    set((state) => {
      const sorted = [...state.elements].sort((a, b) => a.zIndex - b.zIndex);
      const idx = sorted.findIndex((el) => el.id === id);
      if (idx <= 0) return state;

      const current = sorted[idx]!;
      const prev = sorted[idx - 1]!;

      const newElements = state.elements.map((el) => {
        if (el.id === current.id) return { ...el, zIndex: prev.zIndex } as AnyElement;
        if (el.id === prev.id) return { ...el, zIndex: current.zIndex } as AnyElement;
        return el;
      });

      return withPageSync(state, newElements);
    }),

  bringToFront: (id) =>
    set((state) => {
      const maxZ = Math.max(0, ...state.elements.map((el) => el.zIndex));

      const newElements = state.elements.map((el) =>
        el.id === id ? ({ ...el, zIndex: maxZ + 1 } as AnyElement) : el,
      );

      return withPageSync(state, newElements);
    }),

  sendToBack: (id) =>
    set((state) => {
      const minZ = Math.min(0, ...state.elements.map((el) => el.zIndex));

      const newElements = state.elements.map((el) =>
        el.id === id ? ({ ...el, zIndex: minZ - 1 } as AnyElement) : el,
      );

      return withPageSync(state, newElements);
    }),

  reorderElementsByZIndex: (orderedIds) =>
    set((state) => withPageSync(state, reorderZIndices(state.elements, orderedIds))),

  copyToClipboard: () =>
    set((state) => {
      const selected = state.elements
        .filter((el) => state.selectedElementIds.includes(el.id))
        .map((el) => deepCloneElement(el));
      return { clipboard: selected, pasteOffset: 1 };
    }),

  incrementPasteOffset: () =>
    set((state) => ({ pasteOffset: state.pasteOffset + 1 })),

  triggerRebuildCanvas: () =>
    set((state) => ({ rebuildCanvasVersion: state.rebuildCanvasVersion + 1 })),

  triggerUndo: () =>
    set((state) => ({ triggeredUndo: state.triggeredUndo + 1 })),

  triggerRedo: () =>
    set((state) => ({ triggeredRedo: state.triggeredRedo + 1 })),

  setZoom: (zoom) => set({ zoom: clampZoom(zoom) }),

  zoomIn: () =>
    set((state) => ({ zoom: nextZoomStep(state.zoom) })),

  zoomOut: () =>
    set((state) => ({ zoom: prevZoomStep(state.zoom) })),

  zoomReset: () => set({ zoom: 1 }),

  triggerShapeAdd: (shapeType) =>
    set((state) => ({
      pendingShapeType: shapeType,
      triggeredShapeAdd: state.triggeredShapeAdd + 1,
    })),

  groupSelected: (group, childIds) =>
    set((state) =>
      withPageSync(
        state,
        state.elements.filter((el) => !childIds.includes(el.id)).concat(group as AnyElement),
        { selectedElementIds: [group.id] },
      ),
    ),

  ungroupSelected: (groupId, children) =>
    set((state) =>
      withPageSync(
        state,
        state.elements.filter((el) => el.id !== groupId).concat(children),
        { selectedElementIds: children.map((c) => c.id) },
      ),
    ),

  triggerGroup: () =>
    set((state) => ({ triggeredGroup: state.triggeredGroup + 1 })),

  triggerUngroup: () =>
    set((state) => ({ triggeredUngroup: state.triggeredUngroup + 1 })),

  setCropMode: (elementId, snapshot) =>
    set({
      cropModeElementId: elementId,
      cropModeSnapshot: snapshot ?? null,
    }),

  triggerFontReload: () =>
    set((state) => ({ fontReloadVersion: state.fontReloadVersion + 1 })),

  setPageBackground: (bg) =>
    set((state) => ({
      pageBackground: bg,
      pages: state.pages.map((p) =>
        p.id === state.activePageId ? { ...p, background: bg } : p,
      ),
    })),

  setActivePage: (id) =>
    set((state) => {
      if (state.activePageId === id) return state;

      const updatedPages = state.pages.map((p) => {
        if (p.id === state.activePageId) {
          return { ...p, elements: state.elements, background: state.pageBackground };
        }
        return p;
      });

      const newPage = updatedPages.find((p) => p.id === id);
      if (!newPage) return state;

      return {
        activePageId: id,
        pages: updatedPages,
        elements: newPage.elements,
        pageBackground: newPage.background,
        selectedElementIds: [],
        rebuildCanvasVersion: state.rebuildCanvasVersion + 1,
      };
    }),

  createPage: (width, height, namePrefix) =>
    set((state) => {
      const updatedPages = state.pages.map((p) => {
        if (p.id === state.activePageId) {
          return { ...p, elements: state.elements, background: state.pageBackground };
        }
        return p;
      });

      const pageNum = state.nextPageNumber;
      const pageName = `${namePrefix || 'Page'} ${pageNum}`;
      const newPage: PageData = {
        id: generateId(),
        name: pageName,
        pageNumber: pageNum,
        width: width ?? 1080,
        height: height ?? 1080,
        background: {
          type: 'color',
          color: '#ffffff',
          src: '',
          assetId: '',
          gradientStops: [
            { offset: 0, color: '#ffffff' },
            { offset: 1, color: '#cccccc' },
          ],
          direction: 0,
        },
        elements: [],
      };

      return {
        pages: [...updatedPages, newPage],
        activePageId: newPage.id,
        elements: [],
        pageBackground: newPage.background,
        selectedElementIds: [],
        rebuildCanvasVersion: state.rebuildCanvasVersion + 1,
        nextPageNumber: state.nextPageNumber + 1,
      };
    }),

  deletePage: (id) =>
    set((state) => {
      if (state.pages.length <= 1) return state;

      const updatedPages = state.pages.filter((p) => p.id !== id);

      if (state.activePageId !== id) {
        return { pages: updatedPages };
      }

      const newActive = updatedPages[0]!;
      return {
        pages: updatedPages,
        activePageId: newActive.id,
        elements: newActive.elements,
        pageBackground: newActive.background,
        selectedElementIds: [],
        rebuildCanvasVersion: state.rebuildCanvasVersion + 1,
      };
    }),

  duplicatePage: (id) =>
    set((state) => {
      const source = state.pages.find((p) => p.id === id);
      if (!source) return state;

      const updatedSourcePages = state.pages.map((p) => {
        if (p.id === state.activePageId) {
          return { ...p, elements: state.elements, background: state.pageBackground };
        }
        return p;
      });

      const newPage: PageData = {
        ...source,
        id: generateId(),
        name: `${source.name} copy`,
        pageNumber: state.nextPageNumber,
        elements: cloneElementsWithNewIds(source.elements),
      };

      const insertAt = updatedSourcePages.findIndex((p) => p.id === id) + 1;
      const updatedPages = [...updatedSourcePages];
      updatedPages.splice(insertAt, 0, newPage);

      return {
        pages: updatedPages,
        activePageId: newPage.id,
        elements: newPage.elements,
        pageBackground: newPage.background,
        selectedElementIds: [],
        rebuildCanvasVersion: state.rebuildCanvasVersion + 1,
        nextPageNumber: state.nextPageNumber + 1,
      };
    }),

  renamePage: (id, name) =>
    set((state) => ({
      pages: state.pages.map((p) =>
        p.id === id ? { ...p, name } : p,
      ),
    })),

  setProjectName: (name) => set({ projectName: name }),

  saveProject: async () => {
    const state = useEditorStore.getState();

    if (state.saveStatus === 'saving') return;

    set({ saveStatus: 'saving' });

    try {
      const data = await serializeProject(
        state.projectId,
        state.projectName,
        state.pages,
        state.activePageId,
        state.elements,
        state.pageBackground,
        state.createdAt || new Date().toISOString(),
      );

      await saveProjectData(state.projectId, state.projectName, JSON.stringify(data));

      if (!state.createdAt) {
        set({ saveStatus: 'saved', createdAt: data.createdAt });
      } else {
        set({ saveStatus: 'saved' });
      }
    } catch {
      set({ saveStatus: 'error' });
    }
  },

  loadProject: async (id) => {
    const record = await loadProjectData(id);
    if (!record) return;

    let data: {
      pages?: PageData[];
      activePageId?: string;
      createdAt?: string;
    };
    try {
      data = JSON.parse(record.data);
    } catch {
      return;
    }

    clearHistory();

    set((state) => {
      revokeBlobUrls(state.elements);

      const loadedPages = data.pages || [];
      const loadedActiveId = data.activePageId || loadedPages[0]?.id || 'page-1';
      const firstPage = loadedPages.find((p: PageData) => p.id === loadedActiveId) || loadedPages[0];

      const maxPageNum = loadedPages.reduce((max, p) => Math.max(max, p.pageNumber ?? 0), 0);

      return {
        projectId: id,
        projectName: record.name,
        createdAt: data.createdAt || record.updatedAt,
        pages: loadedPages,
        activePageId: loadedActiveId,
        elements: firstPage?.elements ?? [],
        pageBackground: firstPage?.background ?? state.pageBackground,
        selectedElementIds: [],
        saveStatus: 'saved' as const,
        rebuildCanvasVersion: state.rebuildCanvasVersion + 1,
        nextPageNumber: maxPageNum + 1,
      };
    });
  },

  newProject: () => {
      clearHistory();

      set((state) => {
      revokeBlobUrls(state.elements);

      const newId = generateId();
      const defaultPage: PageData = {
        id: generateId(),
        name: 'Page 1',
        pageNumber: 1,
        width: 1080,
        height: 1080,
        background: {
          type: 'color' as const,
          color: '#ffffff',
          src: '',
          assetId: '',
          gradientStops: [
            { offset: 0, color: '#ffffff' },
            { offset: 1, color: '#cccccc' },
          ],
          direction: 0,
        },
        elements: [],
      };

      return {
        projectId: newId,
        projectName: 'Untitled Project',
        createdAt: new Date().toISOString(),
        pages: [defaultPage],
        activePageId: defaultPage.id,
        elements: [],
        pageBackground: defaultPage.background,
        selectedElementIds: [],
        saveStatus: 'saved' as const,
        rebuildCanvasVersion: state.rebuildCanvasVersion + 1,
        nextPageNumber: 2,
      };
    });
  },

  markUnsaved: () => set({ saveStatus: 'unsaved' }),

  triggerExport: (format, scale) =>
    set((state) => ({
      triggeredExport: state.triggeredExport + 1,
      exportFormat: format,
      exportScale: scale,
    })),

  triggerOcrDetect: () =>
    set((state) => {
      if (state.ocrStatus === 'loading') return state;
      return {
        ocrStatus: 'loading' as const,
        ocrError: null,
        ocrDetectedCount: 0,
        triggeredOcr: state.triggeredOcr + 1,
      };
    }),

  setOcrLoading: () =>
    set({ ocrStatus: 'loading', ocrError: null, ocrDetectedCount: 0 }),

  setOcrSuccess: (count) =>
    set({
      ocrStatus: 'success',
      ocrDetectedCount: count,
      ocrError: null,
      selectedDetectedRegionId: null,
      pendingEditRegionId: null,
    }),

  setOcrError: (message) =>
    set({ ocrStatus: 'error', ocrDetectedCount: 0, ocrError: message }),

  setOcrIdle: () =>
    set({ ocrStatus: 'idle', ocrError: null, ocrDetectedCount: 0 }),

  setSelectedDetectedRegionId: (id) => set({ selectedDetectedRegionId: id }),

  storeDetections: (pageId, imageId, regions) =>
    set((state) => {
      const isActive = state.activePageId === pageId;
      const apply = (els: AnyElement[]): AnyElement[] =>
        els.map((el) => {
          if (el.id !== imageId) return el;
          const img = el as ImageElement;
          return { ...img, detectedTexts: regions } as ImageElement;
        });
      return {
        elements: isActive ? apply(state.elements) : state.elements,
        pages: state.pages.map((p) =>
          p.id === pageId ? { ...p, elements: apply(p.elements) } : p,
        ),
      };
    }),

  triggerEditRegion: (regionId) =>
    set((state) => ({
      pendingEditRegionId: regionId,
      triggeredEditRegion: state.triggeredEditRegion + 1,
    })),

  triggerConvertAll: () =>
    set((state) => ({ triggeredConvertAll: state.triggeredConvertAll + 1 })),

  triggerClearDetections: () =>
    set((state) => ({
      triggeredClearDetections: state.triggeredClearDetections + 1,
    })),

  /**
   * CHECKPOINT 36.5G — clear the OCR detection state for an image.
   *
   * Non-destructive by design: removes only the transient `detectedTexts`
   * metadata (overlays, region selection, armed proxy reference, OCR status).
   * The raster (src), masks and TextElements are never touched.
   *
   * Safety: if the target image has any `converted` or `transformed` region the
   * operation is refused entirely — silently wiping user edits is forbidden.
   */
  clearDetections: (imageId) =>
    set((state) => {
      const targetId =
        imageId ??
        (state.elements.find(
          (el) =>
            el.type === 'image' &&
            ((el as ImageElement).detectedTexts?.length ?? 0) > 0,
        ) as ImageElement | undefined)?.id;

      const target = targetId
        ? (state.elements.find((el) => el.id === targetId) as
            | ImageElement
            | undefined)
        : undefined;

      const hasProtectedRegions =
        target?.detectedTexts?.some(
          (r) => r.status === 'converted' || r.status === 'transformed',
        ) ?? false;

      if (hasProtectedRegions) {
        return state;
      }

      const apply = (els: AnyElement[]): AnyElement[] =>
        els.map((el) => {
          if (targetId && el.id !== targetId) return el;
          if (el.type !== 'image') return el;
          return { ...el, detectedTexts: undefined } as ImageElement;
        });

      return {
        elements: apply(state.elements),
        pages: state.pages.map((p) => ({
          ...p,
          elements: apply(p.elements),
        })),
        selectedDetectedRegionId: null,
        pendingEditRegionId: null,
        armedElement: null,
        armedRegionId: null,
        ocrStatus: 'idle' as const,
        ocrDetectedCount: 0,
        ocrError: null,
      };
    }),

  commitRegionConversion: (pageId, imageId, updates) =>
    set((state) => {
      const isActive = state.activePageId === pageId;

      const regionToElement = new Map<string, string>();
      updates.convertedRegionIds.forEach((rid, i) => {
        const el = updates.elements[i];
        if (el) regionToElement.set(rid, el.id);
      });

      const apply = (els: AnyElement[]): AnyElement[] =>
        els.map((el) => {
          if (el.id !== imageId) return el;
          const img = el as ImageElement;
          return {
            ...img,
            src: updates.maskedImageSrc ?? img.src,
            originalSrc: updates.originalSrc,
            textMasks: updates.masks,
            detectedTexts: img.detectedTexts?.map((r) =>
              regionToElement.has(r.id)
                ? { ...r, status: 'converted' as const, textLayerId: regionToElement.get(r.id) }
                : r,
            ),
          } as ImageElement;
        });

      const clearedSelection = updates.convertedRegionIds.includes(
        state.selectedDetectedRegionId ?? '',
      );

      return {
        elements: isActive
          ? [...apply(state.elements), ...updates.elements]
          : state.elements,
        pages: state.pages.map((p) =>
          p.id === pageId
            ? { ...p, elements: [...apply(p.elements), ...updates.elements] }
            : p,
        ),
        selectedDetectedRegionId: clearedSelection
          ? null
          : state.selectedDetectedRegionId,
      };
    }),

  setArmedRegion: (element, regionId) =>
    set({ armedElement: element, armedRegionId: regionId }),

  updateArmedElement: (updates) =>
    set((state) => ({
      armedElement: state.armedElement
        ? ({ ...state.armedElement, ...updates } as TextElement)
        : state.armedElement,
    })),

  applyArmedTextualEdit: (updates) =>
    set((state) => ({
      armedElement: state.armedElement
        ? ({ ...state.armedElement, ...updates } as TextElement)
        : state.armedElement,
      armedTextualEditVersion: state.armedTextualEditVersion + 1,
    })),

  clearArmedRegion: () =>
    set((state) => {
      const armedRegionId = state.armedRegionId;

      const apply = (els: AnyElement[]): AnyElement[] => {
        if (!armedRegionId) return els;
        return els.map((el) => {
          if (el.type !== 'image') return el;
          const img = el as ImageElement;
          return {
            ...img,
            detectedTexts: img.detectedTexts?.map((r) =>
              r.id === armedRegionId && r.status === 'armed'
                ? { ...r, status: 'detected' as const }
                : r,
            ),
          } as ImageElement;
        });
      };

      return {
        elements: apply(state.elements),
        pages: state.pages.map((p) =>
          p.id === state.activePageId ? { ...p, elements: apply(p.elements) } : p,
        ),
        armedElement: null,
        armedRegionId: null,
      };
    }),

  commitArmedConversion: (pageId, imageId, updates) =>
    set((state) => {
      const isActive = state.activePageId === pageId;

      const apply = (els: AnyElement[]): AnyElement[] =>
        els.map((el) => {
          if (el.id === imageId) {
            const img = el as ImageElement;
            return {
              ...img,
              src: updates.maskedImageSrc,
              originalSrc: updates.originalSrc,
              textMasks: updates.masks,
              detectedTexts: img.detectedTexts?.map((r) =>
                r.id === updates.regionId
                  ? {
                      ...r,
                      status: 'converted' as const,
                      textLayerId: updates.element.id,
                    }
                  : r,
              ),
            } as ImageElement;
          }
          return el;
        });

      return {
        elements: isActive
          ? [...apply(state.elements), updates.element]
          : state.elements,
        pages: state.pages.map((p) =>
          p.id === pageId
            ? { ...p, elements: [...apply(p.elements), updates.element] }
            : p,
        ),
        armedElement: null,
        armedRegionId: null,
        selectedDetectedRegionId:
          state.selectedDetectedRegionId === updates.regionId
            ? null
            : state.selectedDetectedRegionId,
      };
    }),

  commitProxyTransform: (pageId, imageId, updates) =>
    set((state) => {
      const isActive = state.activePageId === pageId;

      const apply = (els: AnyElement[]): AnyElement[] =>
        els.map((el) => {
          if (el.id !== imageId) return el;
          const img = el as ImageElement;
          return {
            ...img,
            src: updates.maskedImageSrc,
            originalSrc: updates.originalSrc,
            textMasks: updates.masks,
            detectedTexts: img.detectedTexts?.map((r) =>
              r.id === updates.regionId
                ? { ...r, status: 'transformed' as const, proxyTransform: updates.transform }
                : r,
            ),
          } as ImageElement;
        });

      return {
        elements: isActive ? apply(state.elements) : state.elements,
        pages: state.pages.map((p) =>
          p.id === pageId ? { ...p, elements: apply(p.elements) } : p,
        ),
      };
    }),
}));
