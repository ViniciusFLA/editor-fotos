'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { FabricImage, IText, FabricObject, Rect, Circle, Line, ActiveSelection } from 'fabric';
import { useCanvas } from '@/hooks/use-canvas';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { useEditorStore } from '@/stores/editor-store';
import { generateId } from '@/utils';
import {
  setElementId,
  syncElementToFabric,
  findFabricObjectById,
  createFabricObject,
} from '@/editor/core/element-factory';
import { pushHistoryImmediate } from '@/editor/history/history-manager';
import { validateImageFile } from '@/lib/image-validation';
import { downloadDataUrl, getExportFileName } from '@/lib/export-utils';
import { ContextMenu, ICON_MAP } from '@/components/editor/context-menu';
import { useTranslation } from '@/i18n';
import { fetchOcrResult, OcrFlowError } from '@/editor/ocr/ocr-flow';
import { processOcrResult, EditableTextPipelineError, isResultStale } from '@/editor/pipeline/editable-text-pipeline';
import type { ContextMenuItem } from '@/components/editor/context-menu';
import type { ImageElement, TextElement, ShapeElement } from '@/types';

const LOGICAL_WIDTH = 1080;
const LOGICAL_HEIGHT = 1080;

const MAX_IMAGE_DIMENSION = 0.7;

export function CanvasArea() {
  const { t } = useTranslation();
  const {
    canvasElRef,
    containerRef,
    canvasInstanceRef,
    syncingFromCanvasRef,
    isTextEditingRef,
    scale,
    canvasReady,
    resetTextEditing,
  } = useCanvas({ logicalWidth: LOGICAL_WIDTH, logicalHeight: LOGICAL_HEIGHT });

  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  const pendingImageSrc = useEditorStore((s) => s.pendingImageSrc);
  const setPendingImageSrc = useEditorStore((s) => s.setPendingImageSrc);
  const setUploadError = useEditorStore((s) => s.setUploadError);
  const triggeredTextAdd = useEditorStore((s) => s.triggeredTextAdd);
  const rebuildCanvasVersion = useEditorStore((s) => s.rebuildCanvasVersion);
  const triggeredUndo = useEditorStore((s) => s.triggeredUndo);
  const triggeredRedo = useEditorStore((s) => s.triggeredRedo);
  const triggeredShapeAdd = useEditorStore((s) => s.triggeredShapeAdd);
  const pendingShapeType = useEditorStore((s) => s.pendingShapeType);
  const triggeredGroup = useEditorStore((s) => s.triggeredGroup);
  const triggeredUngroup = useEditorStore((s) => s.triggeredUngroup);
  const fontReloadVersion = useEditorStore((s) => s.fontReloadVersion);
  const triggeredExport = useEditorStore((s) => s.triggeredExport);
  const exportFormat = useEditorStore((s) => s.exportFormat);
  const exportScale = useEditorStore((s) => s.exportScale);
  const selectedElementIds = useEditorStore((s) => s.selectedElementIds);
  const triggeredOcr = useEditorStore((s) => s.triggeredOcr);

  const insertImage = useCallback(
    async (src: string) => {
      const canvas = canvasInstanceRef.current;
      if (!canvas) return;

      const store = useEditorStore.getState();
      pushHistoryImmediate(store.activePageId, store.elements, store.pageBackground);

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
          name: t('imageDefault'),
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
          filters: {
            brightness: 0,
            contrast: 0,
            saturation: 0,
            blur: 0,
            grayscale: false,
          },
          naturalWidth: naturalW,
          naturalHeight: naturalH,
        };

        useEditorStore.getState().addElement(imageElement);
        canvas.setActiveObject(fabricImage);
      } catch {
        setUploadError(t('uploadError'));
      }
    },
    [canvasInstanceRef, setUploadError, t],
  );

  useEffect(() => {
    if (!pendingImageSrc || !canvasReady) return;

    insertImage(pendingImageSrc);
    setPendingImageSrc(null);
  }, [pendingImageSrc, canvasReady, insertImage, setPendingImageSrc]);

  const insertText = useCallback(() => {
    const canvas = canvasInstanceRef.current;
    if (!canvas) return;

    const store = useEditorStore.getState();
    pushHistoryImmediate(store.activePageId, store.elements, store.pageBackground);

    const id = generateId();

    const nextZIndex =
      Math.max(
        0,
        ...store.elements.map((el) => el.zIndex),
      ) + 1;

    const textElement: TextElement = {
      id,
      type: 'text',
      name: t('textLayerDefault'),
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
      text: t('textDefault'),
      fontFamily: 'Arial',
      fontSize: 40,
      fontWeight: 'normal',
      fontStyle: 'normal',
      textAlign: 'center',
      fill: '#000000',
      letterSpacing: 0,
      lineHeight: 1.2,
    };

    const fabricText = new IText(textElement.text, {
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

    store.addElement(textElement);
  }, [canvasInstanceRef, t]);

  const insertShape = useCallback(
    (shapeType: ShapeElement['shapeType']) => {
      const canvas = canvasInstanceRef.current;
      if (!canvas) return;

      const store = useEditorStore.getState();
      pushHistoryImmediate(store.activePageId, store.elements, store.pageBackground);

      const id = generateId();

      const nextZIndex =
        Math.max(
          0,
          ...store.elements.map((el) => el.zIndex),
        ) + 1;

      const defaults = {
        x: LOGICAL_WIDTH / 2 - 100,
        y: LOGICAL_HEIGHT / 2 - 100,
        width: 200,
        height: 200,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        opacity: 1,
        visible: true,
        locked: false,
        zIndex: nextZIndex,
      };

      const shapeElement: ShapeElement = {
        id,
        type: 'shape',
        name: shapeType.charAt(0).toUpperCase() + shapeType.slice(1),
        ...defaults,
        shapeType,
        fill: 'transparent',
        stroke: '#3b82f6',
        strokeWidth: 2,
      };

      let fabricObj: Rect | Circle | Line;

      const common = {
        left: shapeElement.x,
        top: shapeElement.y,
        angle: shapeElement.rotation,
        opacity: shapeElement.opacity,
        visible: shapeElement.visible,
        fill: shapeElement.fill,
        stroke: shapeElement.stroke,
        strokeWidth: shapeElement.strokeWidth,
      };

      switch (shapeType) {
        case 'rectangle':
          fabricObj = new Rect({
            ...common,
            width: shapeElement.width,
            height: shapeElement.height,
          });
          break;
        case 'circle': {
          const radius = Math.min(shapeElement.width, shapeElement.height) / 2;
          fabricObj = new Circle({
            ...common,
            radius,
          });
          break;
        }
        case 'line':
          fabricObj = new Line(
            [
              shapeElement.x,
              shapeElement.y,
              shapeElement.x + shapeElement.width,
              shapeElement.y,
            ],
            {
              stroke: shapeElement.stroke,
              strokeWidth: shapeElement.strokeWidth,
              left: shapeElement.x,
              top: shapeElement.y,
              angle: shapeElement.rotation,
              opacity: shapeElement.opacity,
              visible: shapeElement.visible,
            },
          );
          break;
      }

      setElementId(fabricObj, id);

      canvas.add(fabricObj);
      canvas.setActiveObject(fabricObj);
      canvas.requestRenderAll();

      store.addElement(shapeElement);
    },
    [canvasInstanceRef],
  );

  useEffect(() => {
    if (!canvasReady || triggeredTextAdd === 0) return;

    insertText();
  }, [triggeredTextAdd, canvasReady, insertText]);

  useEffect(() => {
    if (!canvasReady || triggeredShapeAdd === 0) return;
    if (!pendingShapeType) return;

    insertShape(pendingShapeType);
  }, [triggeredShapeAdd, canvasReady, insertShape, pendingShapeType]);

  const restoreSelectionAfterRebuild = useCallback((canvas: import('fabric').Canvas) => {
    const store = useEditorStore.getState();
    const ids = store.selectedElementIds;
    if (ids.length === 0) return;

    const objects = ids
      .map((id) => findFabricObjectById(canvas, id))
      .filter((o): o is NonNullable<typeof o> => o != null);

    if (objects.length === 0) {
      store.setSelectedElementIds([]);
      return;
    }

    if (objects.length === 1) {
      canvas.setActiveObject(objects[0]);
    } else {
      canvas.setActiveObject(new ActiveSelection(objects, { canvas }));
    }

    canvas.requestRenderAll();
  }, []);

  useEffect(() => {
    if (rebuildCanvasVersion === 0) return;

    const canvas = canvasInstanceRef.current;
    if (!canvas || !canvasReady) return;

    resetTextEditing();

    canvas.clear();

    const store = useEditorStore.getState();

    // Sort by zIndex so the base image (lowest) renders behind text layers.
    // Await every object (image loads are async) and add them in z-order,
    // preventing the async image from being added on top of the text layers.
    const sorted = [...store.elements].sort((a, b) => a.zIndex - b.zIndex);

    const tasks = sorted.map(async (el) => {
      const fabricObj = createFabricObject(el);
      const resolved = fabricObj instanceof Promise ? await fabricObj : fabricObj;
      setElementId(resolved, el.id);
      return resolved;
    });

    Promise.allSettled(tasks).then((results) => {
      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          canvas.add(result.value);
        }
      });
      canvas.requestRenderAll();
      restoreSelectionAfterRebuild(canvas);
    });
  }, [rebuildCanvasVersion, canvasReady, canvasInstanceRef, restoreSelectionAfterRebuild, resetTextEditing]);

  const prevElementRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isTextEditingRef.current) return;
    if (!canvasReady) return;
    if (selectedElementIds.length === 0) {
      resetTextEditing();
    }
  }, [selectedElementIds, canvasReady, isTextEditingRef, resetTextEditing]);

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

  const { handleUndo, handleRedo, handleGroup, handleUngroup, handleDelete, handleDuplicate, handlePaste } =
    useKeyboardShortcuts({
      canvasInstanceRef,
      isTextEditingRef,
      containerRef,
    });

  useEffect(() => {
    if (!canvasReady || triggeredUndo === 0) return;
    handleUndo();
  }, [triggeredUndo, canvasReady, handleUndo]);

  useEffect(() => {
    if (!canvasReady || triggeredRedo === 0) return;
    handleRedo();
  }, [triggeredRedo, canvasReady, handleRedo]);

  useEffect(() => {
    if (!canvasReady || triggeredGroup === 0) return;
    handleGroup();
  }, [triggeredGroup, canvasReady, handleGroup]);

  useEffect(() => {
    if (!canvasReady || triggeredUngroup === 0) return;
    handleUngroup();
  }, [triggeredUngroup, canvasReady, handleUngroup]);

  useEffect(() => {
    if (!canvasReady || fontReloadVersion === 0) return;

    const canvas = canvasInstanceRef.current;
    if (!canvas) return;

    canvas.requestRenderAll();
  }, [fontReloadVersion, canvasReady, canvasInstanceRef]);

  useEffect(() => {
    if (!canvasReady || triggeredExport === 0) return;

    const canvas = canvasInstanceRef.current;
    if (!canvas) return;

    const fmt = exportFormat === 'jpeg' ? 'jpeg' : exportFormat;
    const quality = exportFormat === 'jpeg' ? 0.95 : 1;

    canvas.discardActiveObject();
    canvas.requestRenderAll();

    const dataUrl = canvas.toDataURL({
      format: fmt,
      quality,
      multiplier: exportScale,
    });

    downloadDataUrl(dataUrl, getExportFileName(exportFormat));
  }, [triggeredExport, canvasReady, exportFormat, exportScale, canvasInstanceRef]);

  useEffect(() => {
    if (!canvasReady || triggeredOcr === 0) return;

    const run = async () => {
      try {
        const { result, sourceImage, sourcePageId, sourceImageId } =
          await fetchOcrResult();

        // ETAPA 36 — single central pipeline (OCR → filter → mask → inpaint → TextElement).
        const pipelineResult = await processOcrResult({
          sourceImage,
          ocrResult: result,
          sourcePageId,
        });

        // Re-validate context right before the atomic commit (stale-result guard).
        const state = useEditorStore.getState();
        if (isResultStale(state.pages, sourcePageId, sourceImageId)) {
          useEditorStore.getState().setOcrError('staleResult');
          return;
        }

        const sourcePage = state.pages.find((p) => p.id === sourcePageId);
        if (!sourcePage) {
          useEditorStore.getState().setOcrError('staleResult');
          return;
        }

        pushHistoryImmediate(sourcePageId, sourcePage.elements, sourcePage.background);

        // ETAPA 36 — atomic state commit: the source image (masked src + masks +
        // originalSrc) and the new text layers are committed in a single store
        // update, so no partial state can be observed.
        useEditorStore.getState().commitEditableTextResult(sourcePageId, sourceImageId, {
          maskedImageSrc: pipelineResult.maskedImageSrc,
          masks: pipelineResult.masks,
          elements: pipelineResult.elements,
          originalSrc: pipelineResult.originalSrc,
        });

        // ETAPA 34 behaviour preserved: swap the live Fabric image via setSrc
        // (no full rebuild) and add the OCR IText layers directly on top so they
        // stay interactive.
        const canvas = canvasInstanceRef.current;
        if (canvas && state.activePageId === sourcePageId) {
          const fabricImage = findFabricObjectById(canvas, sourceImageId);
          if (fabricImage instanceof FabricImage) {
            try {
              await fabricImage.setSrc(pipelineResult.maskedImageSrc);
            } catch (err) {
              console.warn('[OCR] failed to swap masked image src', err);
            }
          }

          const fabricObjects = await Promise.all(
            pipelineResult.elements.map(async (el) => {
              const obj = createFabricObject(el);
              return obj instanceof Promise ? await obj : obj;
            }),
          );
          canvas.add(...fabricObjects);
          if (fabricObjects.length > 0) {
            canvas.setActiveObject(fabricObjects[0]!);
          }
          canvas.requestRenderAll();
        }

        console.info(
          `[OCR] pipeline metrics: ${JSON.stringify(pipelineResult.metrics)}`,
        );

        useEditorStore.getState().markUnsaved();
        useEditorStore.getState().setOcrSuccess(pipelineResult.elements.length);
      } catch (error) {
        const code =
          error instanceof OcrFlowError ||
          error instanceof EditableTextPipelineError
            ? error.code
            : 'httpError';
        useEditorStore.getState().setOcrError(code);
      }
    };

    run();
  }, [triggeredOcr, canvasReady, canvasInstanceRef]);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const clipboardItems = useEditorStore((s) => s.clipboard);
  const elementCount = useEditorStore((s) => s.elements.length);

  const contextMenuItems = useMemo<ContextMenuItem[]>(() => {
    const hasSelection = selectedElementIds.length > 0;
    const hasMultiple = selectedElementIds.length >= 2;
    const isGroup = selectedElementIds.length === 1 &&
      useEditorStore.getState().elements.find((e) => e.id === selectedElementIds[0])?.type === 'group';
    const hasClipboard = clipboardItems.length > 0;

    return [
      {
        label: t('editor.contextMenu.copy'),
        shortcut: 'Ctrl+C',
        icon: ICON_MAP.copy,
        disabled: !hasSelection,
        onClick: () => useEditorStore.getState().copyToClipboard(),
      },
      {
        label: t('editor.contextMenu.paste'),
        shortcut: 'Ctrl+V',
        icon: ICON_MAP.paste,
        disabled: !hasClipboard,
        onClick: () => handlePaste(),
      },
      { label: '', onClick: () => {}, separator: true },
      {
        label: t('editor.contextMenu.duplicate'),
        shortcut: 'Ctrl+D',
        icon: ICON_MAP.duplicate,
        disabled: !hasSelection,
        onClick: () => handleDuplicate(),
      },
      {
        label: t('editor.contextMenu.delete'),
        shortcut: 'Del',
        icon: ICON_MAP.delete,
        disabled: !hasSelection,
        onClick: () => handleDelete(),
      },
      { label: '', onClick: () => {}, separator: true },
      {
        label: t('editor.contextMenu.group'),
        shortcut: 'Ctrl+G',
        icon: ICON_MAP.group,
        disabled: !hasMultiple,
        onClick: () => handleGroup(),
      },
      {
        label: t('editor.contextMenu.ungroup'),
        shortcut: 'Ctrl+Shift+G',
        icon: ICON_MAP.ungroup,
        disabled: !isGroup,
        onClick: () => handleUngroup(),
      },
    ];
  }, [selectedElementIds, clipboardItems, handlePaste, handleDuplicate, handleDelete, handleGroup, handleUngroup, t]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

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
    <div className='flex flex-1 bg-[#e5e5e5] overflow-hidden relative'>
      <div
        ref={containerRef}
        className={`relative flex-1 overflow-hidden transition-colors ${
          isDragging ? 'bg-blue-50 ring-2 ring-blue-400 ring-inset' : ''
        }`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onContextMenu={handleContextMenu}
      >
        {!canvasReady && (
          <div className='absolute inset-0 flex items-center justify-center bg-[#e5e5e5] z-10'>
            <div className='flex flex-col items-center gap-2'>
              <div className='h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground' />
              <span className='text-[11px] text-muted-foreground'>
                {t('editor.canvas.loading')}
              </span>
            </div>
          </div>
        )}

        {canvasReady && elementCount === 0 && (
          <div className='absolute inset-0 flex items-center justify-center pointer-events-none z-0'>
            <div className='flex flex-col items-center gap-1 text-center'>
              <span className='text-[13px] text-muted-foreground/60 font-medium'>
                {t('editor.canvas.empty')}
              </span>
              <span className='text-[11px] text-muted-foreground/40'>
                {t('editor.canvas.emptyHint')}
              </span>
            </div>
          </div>
        )}

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

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
