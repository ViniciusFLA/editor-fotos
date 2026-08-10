'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { FabricImage, FabricText, FabricObject } from 'fabric';
import { useCanvas } from '@/hooks/use-canvas';
import { useEditorStore } from '@/stores/editor-store';
import { generateId } from '@/utils';
import { setElementId, syncElementToFabric, findFabricObjectById } from '@/editor/core/element-factory';
import { validateImageFile } from '@/lib/image-validation';
import type { ImageElement, TextElement, AnyElement } from '@/types';

const LOGICAL_WIDTH = 1080;
const LOGICAL_HEIGHT = 1080;

const MAX_IMAGE_DIMENSION = 0.7;

export function CanvasArea() {
  const {
    canvasElRef,
    containerRef,
    canvasInstanceRef,
    syncingFromCanvasRef,
    isTextEditingRef,
    scale,
    canvasReady,
  } = useCanvas({ logicalWidth: LOGICAL_WIDTH, logicalHeight: LOGICAL_HEIGHT });

  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  const pendingImageSrc = useEditorStore((s) => s.pendingImageSrc);
  const setPendingImageSrc = useEditorStore((s) => s.setPendingImageSrc);
  const setUploadError = useEditorStore((s) => s.setUploadError);
  const triggeredTextAdd = useEditorStore((s) => s.triggeredTextAdd);

  const insertImage = useCallback(
    async (src: string) => {
      const canvas = canvasInstanceRef.current;
      if (!canvas) return;

      try {
        const fabricImage = await FabricImage.fromURL(src);

        if (!fabricImage.width || !fabricImage.height) return;

        const maxW = LOGICAL_WIDTH * MAX_IMAGE_DIMENSION;
        const maxH = LOGICAL_HEIGHT * MAX_IMAGE_DIMENSION;

        const naturalW = fabricImage.width;
        const naturalH = fabricImage.height;

        const scaleRatio = Math.min(maxW / naturalW, maxH / naturalH, 1);

        const displayW = naturalW * scaleRatio;
        const displayH = naturalH * scaleRatio;

        const id = generateId();
        const assetId = generateId();

        const nextZIndex =
          Math.max(
            0,
            ...useEditorStore.getState().elements.map((el) => el.zIndex),
          ) + 1;

        fabricImage.set({
          left: (LOGICAL_WIDTH - displayW) / 2,
          top: (LOGICAL_HEIGHT - displayH) / 2,
          scaleX: scaleRatio,
          scaleY: scaleRatio,
        });

        setElementId(fabricImage, id);

        canvas.add(fabricImage);
        canvas.requestRenderAll();

        const imageElement: ImageElement = {
          id,
          type: 'image',
          name: 'Image',
          x: (LOGICAL_WIDTH - displayW) / 2,
          y: (LOGICAL_HEIGHT - displayH) / 2,
          width: naturalW,
          height: naturalH,
          scaleX: scaleRatio,
          scaleY: scaleRatio,
          rotation: 0,
          opacity: 1,
          visible: true,
          locked: false,
          zIndex: nextZIndex,
          assetId,
          src,
          cropX: 0,
          cropY: 0,
          cropWidth: naturalW,
          cropHeight: naturalH,
          flipX: false,
          flipY: false,
        };

        useEditorStore.getState().addElement(imageElement);
        canvas.setActiveObject(fabricImage);
      } catch {
        setUploadError('Erro ao carregar imagem.');
      }
    },
    [canvasInstanceRef, setUploadError],
  );

  useEffect(() => {
    if (!pendingImageSrc || !canvasReady) return;

    insertImage(pendingImageSrc);
    setPendingImageSrc(null);
  }, [pendingImageSrc, canvasReady, insertImage, setPendingImageSrc]);

  const insertText = useCallback(() => {
    const canvas = canvasInstanceRef.current;
    if (!canvas) return;

    const id = generateId();

    const nextZIndex =
      Math.max(
        0,
        ...useEditorStore.getState().elements.map((el) => el.zIndex),
      ) + 1;

    const textElement: TextElement = {
      id,
      type: 'text',
      name: 'Text',
      x: LOGICAL_WIDTH / 2,
      y: LOGICAL_HEIGHT / 2,
      width: 200,
      height: 50,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      zIndex: nextZIndex,
      text: 'Double-click to edit',
      fontFamily: 'Arial',
      fontSize: 40,
      fontWeight: 'normal',
      fontStyle: 'normal',
      textAlign: 'center',
      fill: '#000000',
      letterSpacing: 0,
      lineHeight: 1.2,
    };

    const fabricText = new FabricText(textElement.text, {
      left: textElement.x,
      top: textElement.y,
      fontFamily: textElement.fontFamily,
      fontSize: textElement.fontSize,
      fontWeight: textElement.fontWeight as string | number,
      fontStyle: textElement.fontStyle,
      textAlign: textElement.textAlign,
      fill: textElement.fill,
      charSpacing: textElement.letterSpacing,
      lineHeight: textElement.lineHeight,
      angle: textElement.rotation,
      opacity: textElement.opacity,
      visible: textElement.visible,
      editable: true,
    });

    setElementId(fabricText, id);

    canvas.add(fabricText);
    canvas.setActiveObject(fabricText);
    canvas.requestRenderAll();

    useEditorStore.getState().addElement(textElement);
  }, [canvasInstanceRef]);

  useEffect(() => {
    if (!canvasReady || triggeredTextAdd === 0) return;

    insertText();
  }, [triggeredTextAdd, canvasReady, insertText]);

  const prevElementRef = useRef<string | null>(null);

  const selectedElement = useEditorStore((s) => {
    const id = s.selectedElementIds[0];
    if (!id) return null;
    return s.elements.find((el) => el.id === id) ?? null;
  });

  useEffect(() => {
    if (syncingFromCanvasRef.current) {
      if (selectedElement) {
        prevElementRef.current = JSON.stringify(selectedElement);
      }
      return;
    }

    const canvas = canvasInstanceRef.current;
    if (!canvas || !canvasReady || !selectedElement) {
      prevElementRef.current = null;
      return;
    }

    const serialized = JSON.stringify(selectedElement);
    if (serialized === prevElementRef.current) return;
    prevElementRef.current = serialized;

    const fabricObj = findFabricObjectById(canvas, selectedElement.id);
    if (!fabricObj) {
      prevElementRef.current = null;
      return;
    }

    syncElementToFabric(selectedElement, fabricObj);
    canvas.requestRenderAll();
  }, [selectedElement, canvasReady, canvasInstanceRef, syncingFromCanvasRef]);

  const elementsVisibilityLock = useEditorStore((s) =>
    s.elements.map((el) => `${el.id}:v${el.visible}:l${el.locked}`).join(','),
  );

  useEffect(() => {
    if (syncingFromCanvasRef.current) return;

    const canvas = canvasInstanceRef.current;
    if (!canvas || !canvasReady) return;

    const store = useEditorStore.getState();
    let hasBlockedSelected = false;

    store.elements.forEach((el) => {
      const obj = findFabricObjectById(canvas, el.id);
      if (!obj) return;

      if (obj.visible !== el.visible || obj.selectable === el.locked) {
        syncElementToFabric(el, obj);
      }

      if (store.selectedElementIds.includes(el.id) && (!el.visible || el.locked)) {
        hasBlockedSelected = true;
      }
    });

    if (hasBlockedSelected) {
      canvas.discardActiveObject();

      const validIds = store.selectedElementIds.filter((id) => {
        const el = store.elements.find((e) => e.id === id);
        return el && el.visible && !el.locked;
      });

      store.setSelectedElementIds(validIds);
    }

    canvas.requestRenderAll();
  }, [elementsVisibilityLock, canvasReady, canvasInstanceRef, syncingFromCanvasRef]);

  const elementOrderKey = useEditorStore(
    (s) => s.elements.map((el) => el.id).join(',') + '|' + s.elements.map((el) => el.zIndex).join(','),
  );

  useEffect(() => {
    const canvas = canvasInstanceRef.current;
    if (!canvas || !canvasReady) return;

    const store = useEditorStore.getState();
    const sorted = [...store.elements].sort((a, b) => a.zIndex - b.zIndex);

    const objectPositions = new Map<FabricObject, number>();
    sorted.forEach((el, i) => {
      const obj = findFabricObjectById(canvas, el.id);
      if (obj) {
        objectPositions.set(obj, i);
      }
    });

    if (objectPositions.size === 0) return;

    objectPositions.forEach((targetIdx, obj) => {
      canvas.remove(obj);
      canvas.insertAt(targetIdx, obj);
    });

    canvas.requestRenderAll();
  }, [elementOrderKey, canvasReady, canvasInstanceRef]);

  const handleDelete = useCallback(() => {
    if (isTextEditingRef.current) return;

    const canvas = canvasInstanceRef.current;
    if (!canvas) return;

    const store = useEditorStore.getState();
    const ids = store.selectedElementIds;
    if (ids.length === 0) return;

    ids.forEach((id) => {
      const obj = findFabricObjectById(canvas, id);
      if (obj) {
        canvas.remove(obj);
      }
    });

    canvas.discardActiveObject();
    canvas.requestRenderAll();

    ids.forEach((id) => store.removeElement(id));
  }, [canvasInstanceRef, isTextEditingRef]);

  const handleDuplicate = useCallback(() => {
    if (isTextEditingRef.current) return;

    const canvas = canvasInstanceRef.current;
    if (!canvas) return;

    const store = useEditorStore.getState();
    const ids = store.selectedElementIds;
    if (ids.length === 0) return;

    const nextZIndex =
      Math.max(0, ...store.elements.map((el) => el.zIndex)) + 1;

    ids.forEach((id) => {
      const el = store.elements.find((e) => e.id === id);
      const originalObj = el ? findFabricObjectById(canvas, id) : undefined;
      if (!el || !originalObj) return;

      const newId = generateId();

      const cloned: Record<string, unknown> = { ...el };
      cloned.id = newId;
      cloned.name = `${el.name} copy`;
      cloned.x = el.x + 15;
      cloned.y = el.y + 15;
      cloned.zIndex = nextZIndex + ids.indexOf(id);

      if (el.type === 'image') {
        cloned.assetId = generateId();
      }

      originalObj.clone().then((clonedObj) => {
        const fabricCloned = clonedObj as FabricObject;
        fabricCloned.set({
          left: el.x + 15,
          top: el.y + 15,
        });
        setElementId(fabricCloned, newId);
        canvas.add(fabricCloned);
        canvas.requestRenderAll();

        store.addElement(cloned as unknown as AnyElement);
      });
    });
  }, [canvasInstanceRef, isTextEditingRef]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      if (isTextEditingRef.current) return;

      const isCtrl = e.ctrlKey || e.metaKey;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDelete();
        return;
      }

      if (isCtrl && e.key === 'd') {
        e.preventDefault();
        handleDuplicate();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDelete, handleDuplicate, isTextEditingRef]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) {
      setIsDragging(true);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsDragging(false);

      const file = e.dataTransfer.files?.[0];
      if (!file) return;

      const error = validateImageFile(file);
      if (error) {
        setUploadError(error);
        return;
      }

      setUploadError(null);

      const objectUrl = URL.createObjectURL(file);

      const previousSrc = useEditorStore.getState().pendingImageSrc;
      if (previousSrc) {
        URL.revokeObjectURL(previousSrc);
      }

      setPendingImageSrc(objectUrl);
    },
    [setPendingImageSrc, setUploadError],
  );

  return (
    <div className='flex flex-1 bg-[#e5e5e5] overflow-hidden'>
      <div
        ref={containerRef}
        className={`relative flex-1 overflow-hidden transition-colors ${
          isDragging ? 'bg-blue-50 ring-2 ring-blue-400 ring-inset' : ''
        }`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div
          className='absolute'
          style={{
            top: '50%',
            left: '50%',
            transform: `translate(-50%, -50%) scale(${scale})`,
            visibility: canvasReady ? 'visible' : 'hidden',
          }}
        >
          <canvas ref={canvasElRef} />
        </div>
      </div>
    </div>
  );
}
