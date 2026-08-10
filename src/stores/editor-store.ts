import { create } from 'zustand';
import type { AnyElement, GroupElement, ImageElement, PageBackground, PageData } from '@/types';
import type { ShapeType } from '@/types';
import { generateId } from '@/utils';
import { saveProjectData, loadProjectData } from '@/lib/persistence';
import { serializeProject } from '@/lib/project-serializer';

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
  saveStatus: 'saved' | 'unsaved' | 'saving' | 'error';
  triggeredExport: number;
  exportFormat: 'png' | 'jpeg' | 'webp';
  exportScale: number;

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
  createPage: (width?: number, height?: number) => void;
  deletePage: (id: string) => void;
  duplicatePage: (id: string) => void;
  renamePage: (id: string, name: string) => void;

  setProjectName: (name: string) => void;
  saveProject: () => Promise<void>;
  loadProject: (id: string) => Promise<void>;
  newProject: () => void;
  markUnsaved: () => void;

  triggerExport: (format: 'png' | 'jpeg' | 'webp', scale: number) => void;
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
  projectId: generateId(),
  projectName: 'Untitled Project',
  saveStatus: 'saved',
  triggeredExport: 0,
  exportFormat: 'png' as const,
  exportScale: 1,

  setElements: (elements) =>
    set((state) => ({
      elements,
      pages: state.pages.map((p) =>
        p.id === state.activePageId ? { ...p, elements } : p,
      ),
    })),

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

  copyToClipboard: () =>
    set((state) => {
      const selected = state.elements.filter((el) =>
        state.selectedElementIds.includes(el.id),
      );
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
    set((state) => ({
      elements: state.elements
        .filter((el) => !childIds.includes(el.id))
        .concat(group as AnyElement),
      selectedElementIds: [group.id],
    })),

  ungroupSelected: (groupId, children) =>
    set((state) => ({
      elements: state.elements
        .filter((el) => el.id !== groupId)
        .concat(children),
      selectedElementIds: children.map((c) => c.id),
    })),

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

  createPage: (width, height) =>
    set((state) => {
      const updatedPages = state.pages.map((p) => {
        if (p.id === state.activePageId) {
          return { ...p, elements: state.elements, background: state.pageBackground };
        }
        return p;
      });

      const pageNum = state.pages.length + 1;
      const newPage: PageData = {
        id: generateId(),
        name: `Page ${pageNum}`,
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
        elements: source.elements.map((el) => ({ ...el, id: generateId() })),
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
    set({ saveStatus: 'saving' });

    try {
      const data = await serializeProject(
        state.projectId,
        state.projectName,
        state.pages,
        state.activePageId,
        state.elements,
        state.pageBackground,
        state.projectId === generateId() ? new Date().toISOString() : '', // use existing createdAt if known
      );

      await saveProjectData(state.projectId, state.projectName, JSON.stringify(data));
      set({ saveStatus: 'saved' });
    } catch {
      set({ saveStatus: 'error' });
    }
  },

  loadProject: async (id) => {
    const record = await loadProjectData(id);
    if (!record) return;

    const data = JSON.parse(record.data);

    set((state) => {
      const updatedPages = state.pages.map((p) => {
        if (p.id === state.activePageId) {
          return { ...p, elements: state.elements, background: state.pageBackground };
        }
        return p;
      });

      const loadedPages = data.pages || data.pages || [];
      const loadedActiveId = data.activePageId || loadedPages[0]?.id || 'page-1';
      const firstPage = loadedPages.find((p: PageData) => p.id === loadedActiveId) || loadedPages[0];

      return {
        projectId: id,
        projectName: record.name,
        pages: loadedPages,
        activePageId: loadedActiveId,
        elements: firstPage?.elements ?? [],
        pageBackground: firstPage?.background ?? state.pageBackground,
        selectedElementIds: [],
        saveStatus: 'saved' as const,
        rebuildCanvasVersion: (updatedPages[0]?.elements?.length ?? 0) > 0
          ? state.rebuildCanvasVersion + 1
          : state.rebuildCanvasVersion + 1,
      };
    });
  },

  newProject: () =>
    set((state) => {
      const newId = generateId();
      const defaultPage: PageData = {
        id: generateId(),
        name: 'Page 1',
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
        pages: [defaultPage],
        activePageId: defaultPage.id,
        elements: [],
        pageBackground: defaultPage.background,
        selectedElementIds: [],
        saveStatus: 'saved' as const,
        rebuildCanvasVersion: state.rebuildCanvasVersion + 1,
      };
    }),

  markUnsaved: () => set({ saveStatus: 'unsaved' }),

  triggerExport: (format, scale) =>
    set((state) => ({
      triggeredExport: state.triggeredExport + 1,
      exportFormat: format,
      exportScale: scale,
    })),
}));
