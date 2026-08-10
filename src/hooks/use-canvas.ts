'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas } from 'fabric';

interface UseCanvasOptions {
  logicalWidth: number;
  logicalHeight: number;
}

export function useCanvas({ logicalWidth, logicalHeight }: UseCanvasOptions) {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const canvasInstanceRef = useRef<Canvas | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [canvasReady, setCanvasReady] = useState(false);

  useEffect(() => {
    const el = canvasElRef.current;
    if (!el) return;

    let disposed = false;

    const canvas = new Canvas(el, {
      width: logicalWidth,
      height: logicalHeight,
      backgroundColor: '#ffffff',
      selection: false,
      renderOnAddRemove: true,
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
