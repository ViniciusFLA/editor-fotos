'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas, ActiveSelection, Line, FabricObject, FabricImage, Gradient } from 'fabric';
import { getElementId, findFabricObjectById, extractElementUpdates, normalizeFabricObject } from '@/editor/core/element-factory';
import { pushHistoryImmediate } from '@/editor/history/history-manager';
import { useEditorStore } from '@/stores/editor-store';
import type { AnyElement } from '@/types';

interface UseCanvasOptions {
  logicalWidth: number;
  logicalHeight: number;
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((id, i) => id === sortedB[i]);
}

export function useCanvas({ logicalWidth, logicalHeight }: UseCanvasOptions) {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const canvasInstanceRef = useRef<Canvas | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const syncingFromCanvasRef = useRef(false);
  const isTextEditingRef = useRef(false);
  const [baseScale, setBaseScale] = useState(1);
  const [canvasReady, setCanvasReady] = useState(false);

  const zoom = useEditorStore((s) => s.zoom);
  const selectedElementIds = useEditorStore((s) => s.selectedElementIds);

  const displayScale = baseScale * zoom;

  useEffect(() => {
    const el = canvasElRef.current;
    if (!el) return;

    let disposed = false;

    const canvas = new Canvas(el, {
      width: logicalWidth,
      height: logicalHeight,
      backgroundColor: '#ffffff',
      selection: true,
      selectionColor: 'rgba(59, 130, 246, 0.1)',
      selectionBorderColor: '#3b82f6',
      selectionLineWidth: 1,
      selectionDashArray: [4, 4],
      renderOnAddRemove: true,
      preserveObjectStacking: true,
    });

    if (disposed) {
      canvas.dispose();
      return;
    }

    canvasInstanceRef.current = canvas;

    requestAnimationFrame(() => {
      if (!disposed) {
        canvas.renderAll();
        setCanvasReady(true);
      }
    });

    return () => {
      disposed = true;
      setCanvasReady(false);
      const instance = canvasInstanceRef.current;
      canvasInstanceRef.current = null;
      if (instance) {
        instance.dispose();
      }
    };
  }, [logicalWidth, logicalHeight]);

  useEffect(() => {
    const canvas = canvasInstanceRef.current;
    if (!canvas) return;

    const handleEditingEntered = () => {
      isTextEditingRef.current = true;
    };

    const handleEditingExited = () => {
      isTextEditingRef.current = false;
    };

    canvas.on('text:editing:entered', handleEditingEntered);
    canvas.on('text:editing:exited', handleEditingExited);

    return () => {
      canvas.off('text:editing:entered', handleEditingEntered);
      canvas.off('text:editing:exited', handleEditingExited);
    };
  }, [canvasReady]);

  useEffect(() => {
    const canvas = canvasInstanceRef.current;
    if (!canvas) return;

    const handleSelectionChanged = () => {
      syncingFromCanvasRef.current = true;

      const activeObjects = canvas.getActiveObjects();
      const ids = activeObjects
        .map((obj) => getElementId(obj))
        .filter((id): id is string => id !== undefined);

      const currentIds = useEditorStore.getState().selectedElementIds;

      if (!arraysEqual(ids, currentIds)) {
        useEditorStore.getState().setSelectedElementIds(ids);
      }

      requestAnimationFrame(() => {
        syncingFromCanvasRef.current = false;
      });
    };

    canvas.on('selection:created', handleSelectionChanged);
    canvas.on('selection:updated', handleSelectionChanged);
    canvas.on('selection:cleared', handleSelectionChanged);

    return () => {
      canvas.off('selection:created', handleSelectionChanged);
      canvas.off('selection:updated', handleSelectionChanged);
      canvas.off('selection:cleared', handleSelectionChanged);
    };
  }, [canvasReady]);

  useEffect(() => {
    if (syncingFromCanvasRef.current) return;

    const canvas = canvasInstanceRef.current;
    if (!canvas || !canvasReady) return;

    const activeObjects = canvas.getActiveObjects();
    const canvasIds = activeObjects
      .map((obj) => getElementId(obj))
      .filter((id): id is string => id !== undefined);

    if (arraysEqual(canvasIds, selectedElementIds)) return;

    canvas.discardActiveObject();
    canvas.requestRenderAll();

    if (selectedElementIds.length === 0) return;

    const objects = selectedElementIds
      .map((id) => findFabricObjectById(canvas, id))
      .filter((o): o is NonNullable<typeof o> => o != null);

    if (objects.length === 0) return;

    if (objects.length === 1) {
      canvas.setActiveObject(objects[0]);
    } else {
      canvas.setActiveObject(new ActiveSelection(objects, { canvas }));
    }

    canvas.requestRenderAll();
  }, [selectedElementIds, canvasReady]);

  useEffect(() => {
    const canvas = canvasInstanceRef.current;
    if (!canvas) return;

    const handleObjectModified = () => {
      const active = canvas.getActiveObject();
      if (!active) return;

      const id = getElementId(active);
      if (!id) return;

      syncingFromCanvasRef.current = true;

      normalizeFabricObject(active);

      const store = useEditorStore.getState();
      const element = store.elements.find((el) => el.id === id);
      if (!element) {
        syncingFromCanvasRef.current = false;
        return;
      }

      pushHistoryImmediate(store.elements);

      const updates = extractElementUpdates(active, element.type);
      store.updateElement(id, updates);

      canvas.requestRenderAll();

      requestAnimationFrame(() => {
        syncingFromCanvasRef.current = false;
      });
    };

    canvas.on('object:modified', handleObjectModified);

    return () => {
      canvas.off('object:modified', handleObjectModified);
    };
  }, [canvasReady]);

  const guidesRef = useRef<Line[]>([]);

  useEffect(() => {
    const canvas = canvasInstanceRef.current;
    if (!canvas || !canvasReady) return;

    const GUIDE_COLOR = '#3b82f6';
    const GUIDE_THRESHOLD = 5;

    const clearGuides = () => {
      guidesRef.current.forEach((line) => canvas.remove(line));
      guidesRef.current = [];
    };

    const drawGuide = (x1: number, y1: number, x2: number, y2: number) => {
      const line = new Line([x1, y1, x2, y2], {
        stroke: GUIDE_COLOR,
        strokeWidth: 1,
        strokeDashArray: [5, 5],
        selectable: false,
        evented: false,
        excludeFromExport: true,
        hoverCursor: 'default',
      } as Record<string, unknown>);
      canvas.add(line as unknown as FabricObject);
      guidesRef.current.push(line);
    };

    const handleObjectMoving = () => {
      clearGuides();

      const active = canvas.getActiveObject();
      if (!active) return;

      const bounds = active.getBoundingRect();
      const movingLeft = bounds.left;
      const movingTop = bounds.top;
      const movingRight = bounds.left + bounds.width;
      const movingBottom = bounds.top + bounds.height;
      const movingCenterX = bounds.left + bounds.width / 2;
      const movingCenterY = bounds.top + bounds.height / 2;

      const movingXPoints = [movingLeft, movingCenterX, movingRight];
      const movingYPoints = [movingTop, movingCenterY, movingBottom];

      let bestDx = GUIDE_THRESHOLD + 1;
      let bestDy = GUIDE_THRESHOLD + 1;
      let snapGuideH: number | null = null;
      let snapGuideV: number | null = null;

      canvas.getObjects().forEach((obj) => {
        if (obj === active) return;
        const targetId = getElementId(obj);
        if (!targetId) return;
        if (!obj.visible) return;

        const targetBounds = obj.getBoundingRect();
        const targetLeft = targetBounds.left;
        const targetTop = targetBounds.top;
        const targetRight = targetBounds.left + targetBounds.width;
        const targetBottom = targetBounds.top + targetBounds.height;
        const targetCenterX = targetBounds.left + targetBounds.width / 2;
        const targetCenterY = targetBounds.top + targetBounds.height / 2;

        const targetXPoints = [targetLeft, targetCenterX, targetRight];
        const targetYPoints = [targetTop, targetCenterY, targetBottom];

        for (const mx of movingXPoints) {
          for (const tx of targetXPoints) {
            const dx = tx - mx;
            if (Math.abs(dx) < Math.abs(bestDx)) {
              bestDx = dx;
              snapGuideV = tx;
            }
          }
        }

        for (const my of movingYPoints) {
          for (const ty of targetYPoints) {
            const dy = ty - my;
            if (Math.abs(dy) < Math.abs(bestDy)) {
              bestDy = dy;
              snapGuideH = ty;
            }
          }
        }
      });

      let snapped = false;

      if (Math.abs(bestDx) <= GUIDE_THRESHOLD) {
        active.set({ left: (active.left ?? 0) + bestDx });

        if (snapGuideV !== null) {
          drawGuide(snapGuideV, 0, snapGuideV, logicalHeight);
        }
        snapped = true;
      }

      if (Math.abs(bestDy) <= GUIDE_THRESHOLD) {
        active.set({ top: (active.top ?? 0) + bestDy });

        if (snapGuideH !== null) {
          drawGuide(0, snapGuideH, logicalWidth, snapGuideH);
        }
        snapped = true;
      }

      if (snapped) {
        canvas.requestRenderAll();
        return;
      }

      if (Math.abs(movingCenterX - logicalWidth / 2) < GUIDE_THRESHOLD) {
        drawGuide(logicalWidth / 2, 0, logicalWidth / 2, logicalHeight);
      }

      if (Math.abs(movingCenterY - logicalHeight / 2) < GUIDE_THRESHOLD) {
        drawGuide(0, logicalHeight / 2, logicalWidth, logicalHeight / 2);
      }

      if (Math.abs(movingLeft) < GUIDE_THRESHOLD) {
        drawGuide(0, 0, 0, logicalHeight);
      }

      if (Math.abs(movingRight - logicalWidth) < GUIDE_THRESHOLD) {
        drawGuide(logicalWidth, 0, logicalWidth, logicalHeight);
      }

      if (Math.abs(movingTop) < GUIDE_THRESHOLD) {
        drawGuide(0, 0, logicalWidth, 0);
      }

      if (Math.abs(movingBottom - logicalHeight) < GUIDE_THRESHOLD) {
        drawGuide(0, logicalHeight, logicalWidth, logicalHeight);
      }

      canvas.requestRenderAll();
    };

    const handleMouseUp = () => {
      clearGuides();
      canvas.requestRenderAll();
    };

    canvas.on('object:moving', handleObjectMoving);
    canvas.on('mouse:up', handleMouseUp);

    return () => {
      canvas.off('object:moving', handleObjectMoving);
      canvas.off('mouse:up', handleMouseUp);
      clearGuides();
    };
  }, [canvasReady, logicalWidth, logicalHeight]);

  useEffect(() => {
    const canvas = canvasInstanceRef.current;
    if (!canvas || !canvasReady) return;

    const anchorPos = { left: 0, top: 0, cropX: 0, cropY: 0 };
    let cropObj: FabricObject | null = null;

    const handleCropDown = () => {
      const store = useEditorStore.getState();
      const cropId = store.cropModeElementId;
      if (!cropId) return;

      const active = canvas.getActiveObject();
      const activeId = active ? getElementId(active) : undefined;
      if (!active || activeId !== cropId) return;

      if (active.type !== 'image') return;

      const img = active as FabricImage;
      cropObj = img;
      anchorPos.left = img.left ?? 0;
      anchorPos.top = img.top ?? 0;
      anchorPos.cropX = img.cropX;
      anchorPos.cropY = img.cropY;
    };

    const handleCropMoving = () => {
      const store = useEditorStore.getState();
      if (!store.cropModeElementId) return;
      if (!cropObj) return;

      const img = cropObj as FabricImage;
      const sx = img.scaleX ?? 1;
      const sy = img.scaleY ?? 1;

      const dLeft = (img.left ?? 0) - anchorPos.left;
      const dTop = (img.top ?? 0) - anchorPos.top;

      const newCropX = anchorPos.cropX - dLeft / sx;
      const newCropY = anchorPos.cropY - dTop / sy;

      img.cropX = newCropX;
      img.cropY = newCropY;

      img.set({
        left: anchorPos.left,
        top: anchorPos.top,
      });

      store.updateElement(store.cropModeElementId, {
        cropX: newCropX,
        cropY: newCropY,
      } as Partial<AnyElement>);
    };

    const handleCropUp = () => {
      cropObj = null;
    };

    canvas.on('mouse:down', handleCropDown);
    canvas.on('object:moving', handleCropMoving);
    canvas.on('mouse:up', handleCropUp);

    return () => {
      canvas.off('mouse:down', handleCropDown);
      canvas.off('object:moving', handleCropMoving);
      canvas.off('mouse:up', handleCropUp);
    };
  }, [canvasReady, canvasInstanceRef]);

  const recalculateScale = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const { clientWidth, clientHeight } = container;
    if (clientWidth === 0 || clientHeight === 0) return;

    const padding = 32;
    const availableWidth = Math.max(clientWidth - padding * 2, 1);
    const availableHeight = Math.max(clientHeight - padding * 2, 1);

    const scaleX = availableWidth / logicalWidth;
    const scaleY = availableHeight / logicalHeight;
    const newScale = Math.min(scaleX, scaleY, 1);

    setBaseScale(newScale);
  }, [logicalWidth, logicalHeight]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      recalculateScale();
    });

    observer.observe(container);
    recalculateScale();

    return () => {
      observer.disconnect();
    };
  }, [recalculateScale]);

  const pageBackground = useEditorStore((s) => s.pageBackground);

  useEffect(() => {
    const canvas = canvasInstanceRef.current;
    if (!canvas || !canvasReady) return;

    const bg = pageBackground;

    if (bg.type === 'none') {
      canvas.backgroundColor = '';
      canvas.backgroundImage = undefined;
    } else if (bg.type === 'color') {
      canvas.backgroundColor = bg.color;
      canvas.backgroundImage = undefined;
    } else if (bg.type === 'image') {
      canvas.backgroundColor = bg.color || '#ffffff';
      if (bg.src) {
        FabricImage.fromURL(bg.src).then((img) => {
          canvas.backgroundImage = img;
          canvas.requestRenderAll();
        });
      } else {
        canvas.backgroundImage = undefined;
      }
    } else if (bg.type === 'linear-gradient') {
      const angleRad = (bg.direction % 360) * (Math.PI / 180);
      canvas.backgroundColor = new Gradient({
        type: 'linear',
        coords: {
          x1: 0,
          y1: 0,
          x2: Math.sin(angleRad),
          y2: Math.cos(angleRad),
        },
        colorStops: bg.gradientStops.map((s) => ({ offset: s.offset, color: s.color })),
      });
      canvas.backgroundImage = undefined;
    } else if (bg.type === 'radial-gradient') {
      canvas.backgroundColor = new Gradient({
        type: 'radial',
        coords: { x1: 0.5, y1: 0.5, r1: 0, x2: 0.5, y2: 0.5, r2: 0.5 },
        colorStops: bg.gradientStops.map((s) => ({ offset: s.offset, color: s.color })),
      });
      canvas.backgroundImage = undefined;
    }

    canvas.requestRenderAll();
  }, [pageBackground, canvasReady, canvasInstanceRef]);

  return {
    canvasElRef,
    containerRef,
    canvasInstanceRef,
    syncingFromCanvasRef,
    isTextEditingRef,
    scale: displayScale,
    canvasReady,
  };
}
