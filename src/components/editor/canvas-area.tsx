'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { FabricImage } from 'fabric';
import { useCanvas } from '@/hooks/use-canvas';
import { useEditorStore } from '@/stores/editor-store';
import { generateId } from '@/utils';
import { setElementId } from '@/editor/core/element-factory';
import { validateImageFile } from '@/lib/image-validation';
import type { ImageElement } from '@/types';

const LOGICAL_WIDTH = 1080;
const LOGICAL_HEIGHT = 1080;

const MAX_IMAGE_DIMENSION = 0.7;

export function CanvasArea() {
  const {
    canvasElRef,
    containerRef,
    canvasInstanceRef,
    scale,
    canvasReady,
  } = useCanvas({ logicalWidth: LOGICAL_WIDTH, logicalHeight: LOGICAL_HEIGHT });

  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  const pendingImageSrc = useEditorStore((s) => s.pendingImageSrc);
  const setPendingImageSrc = useEditorStore((s) => s.setPendingImageSrc);
  const setUploadError = useEditorStore((s) => s.setUploadError);

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
