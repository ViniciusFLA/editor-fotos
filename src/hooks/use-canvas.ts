'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas, ActiveSelection } from 'fabric';
import { getElementId, findFabricObjectById } from '@/editor/core/element-factory';
import { useEditorStore } from '@/stores/editor-store';

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
  const [scale, setScale] = useState(1);
  const [canvasReady, setCanvasReady] = useState(false);

  const selectedElementIds = useEditorStore((s) => s.selectedElementIds);

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

    setScale(newScale);
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

  return {
    canvasElRef,
    containerRef,
    canvasInstanceRef,
    scale,
    canvasReady,
  };
}
