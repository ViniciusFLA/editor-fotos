'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { FabricImage, IText, FabricObject, Rect, Circle, Line, ActiveSelection } from 'fabric';
import { useCanvas } from '@/hooks/use-canvas';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { useEditorStore } from '@/stores/editor-store';
import { generateId } from '@/utils';
import {
  setElementId,
  getElementId,
  syncElementToFabric,
  findFabricObjectById,
  createFabricObject,
  extractElementUpdates,
} from '@/editor/core/element-factory';
import { pushHistoryImmediate } from '@/editor/history/history-manager';
import { validateImageFile } from '@/lib/image-validation';
import { downloadDataUrl, getExportFileName } from '@/lib/export-utils';
import { ContextMenu, ICON_MAP } from '@/components/editor/context-menu';
import { useTranslation } from '@/i18n';
import { fetchOcrResult, OcrFlowError } from '@/editor/ocr/ocr-flow';
import {
  processDetections,
  convertDetectedRegions,
  convertArmedRegion,
  EditableTextPipelineError,
  isResultStale,
} from '@/editor/pipeline/editable-text-pipeline';
import { mapImageRectToCanvas, convertDetectedTextsToTextElements } from '@/editor/ocr/ocr-to-elements';
import { computeImageFitScale, DEFAULT_MAX_DIMENSION_RATIO } from '@/editor/core/image-fit';
import type { ContextMenuItem } from '@/components/editor/context-menu';
import type { DetectedText } from '@/ai/types/ocr';
import type { DetectedTextRegion, ImageElement, TextElement, ShapeElement } from '@/types';

const LOGICAL_WIDTH = 1080;
const LOGICAL_HEIGHT = 1080;

const regionOverlayMap = new WeakMap<FabricObject, string>();

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
  const triggeredEditRegion = useEditorStore((s) => s.triggeredEditRegion);
  const pendingEditRegionId = useEditorStore((s) => s.pendingEditRegionId);
  const triggeredConvertAll = useEditorStore((s) => s.triggeredConvertAll);
  const detectedOverlayKey = useEditorStore((s) => {
    const image = s.elements.find((el) => el.type === 'image');
    const regions = (image as ImageElement | undefined)?.detectedTexts;
    if (!regions) return '';
    return regions.map((r) => `${r.id}:${r.status}`).join('|');
  });

  const insertImage = useCallback(
    async (src: string) => {
      const canvas = canvasInstanceRef.current;
      if (!canvas) return;

      const store = useEditorStore.getState();
      pushHistoryImmediate(store.activePageId, store.elements, store.pageBackground);

      try {
        const fabricImage = await FabricImage.fromURL(src);

        if (!fabricImage.width || !fabricImage.height) return;

        const maxW = LOGICAL_WIDTH * DEFAULT_MAX_DIMENSION_RATIO;
        const maxH = LOGICAL_HEIGHT * DEFAULT_MAX_DIMENSION_RATIO;

        const naturalW = fabricImage.width;
        const naturalH = fabricImage.height;

        const scaleRatio = computeImageFitScale({
          naturalWidth: naturalW,
          naturalHeight: naturalH,
          availableWidth: maxW,
          availableHeight: maxH,
        });

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

  const overlayObjectsRef = useRef<FabricObject[]>([]);
  const armedConvertingRef = useRef(false);

  const clearDetectedOverlays = useCallback(() => {
    const canvas = canvasInstanceRef.current;
    if (!canvas) return;
    overlayObjectsRef.current.forEach((obj) => canvas.remove(obj));
    overlayObjectsRef.current = [];
  }, [canvasInstanceRef]);

  const renderDetectedOverlays = useCallback(() => {
    const canvas = canvasInstanceRef.current;
    if (!canvas) return;
    clearDetectedOverlays();

    const store = useEditorStore.getState();
    const image = store.elements.find((el) => el.type === 'image') as ImageElement | undefined;
    const regions = image?.detectedTexts?.filter((r) => r.status === 'detected') ?? [];
    if (!image || regions.length === 0) {
      canvas.requestRenderAll();
      return;
    }

    for (const region of regions) {
      const mapped = mapImageRectToCanvas(image, region.boundingBox);
      const rect = new Rect({
        left: mapped.x,
        top: mapped.y,
        width: mapped.width,
        height: mapped.height,
        fill: 'transparent',
        stroke: '#3b82f6',
        strokeWidth: 1,
        strokeDashArray: [4, 4],
        selectable: false,
        evented: true,
        excludeFromExport: true,
        hasControls: false,
        hasBorders: false,
        hoverCursor: 'pointer',
      });
      regionOverlayMap.set(rect, region.id);
      canvas.add(rect);
      overlayObjectsRef.current.push(rect);
    }
    canvas.requestRenderAll();
  }, [canvasInstanceRef, clearDetectedOverlays]);

  useEffect(() => {
    const canvas = canvasInstanceRef.current;
    if (!canvas || !canvasReady) return;

    const handleMouseDown = (e: { target?: FabricObject }) => {
      const target = e.target;
      if (!target) return;
      const regionId = regionOverlayMap.get(target);
      if (regionId) {
        const store = useEditorStore.getState();
        store.setSelectedDetectedRegionId(regionId);
        // Direct edit: clicking a detected text arms it for editing.
        store.triggerEditRegion(regionId);
      }
    };

    canvas.on('mouse:down', handleMouseDown);
    return () => {
      canvas.off('mouse:down', handleMouseDown);
    };
  }, [canvasReady, canvasInstanceRef]);

  useEffect(() => {
    if (!canvasReady) return;
    renderDetectedOverlays();
  }, [detectedOverlayKey, canvasReady, rebuildCanvasVersion, renderDetectedOverlays]);

  useEffect(() => {
    if (!canvasReady || triggeredOcr === 0) return;

    const run = async () => {
      try {
        const { result, sourceImage, sourcePageId, sourceImageId } =
          await fetchOcrResult();

        // CHECKPOINT 36.5 — detection only: no mask, no inpainting, no TextElement.
        const detections = await processDetections({
          sourceImage,
          ocrResult: result,
          sourcePageId,
        });

        const state = useEditorStore.getState();
        if (isResultStale(state.pages, sourcePageId, sourceImageId)) {
          useEditorStore.getState().setOcrError('staleResult');
          return;
        }

        useEditorStore.getState().storeDetections(sourcePageId, sourceImageId, detections.regions);
        useEditorStore.getState().markUnsaved();
        useEditorStore.getState().setOcrSuccess(detections.regions.length);
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

  const updateRegionStatus = useCallback(
    (imageId: string, regionId: string, status: DetectedTextRegion['status']) => {
      const state = useEditorStore.getState();
      const img = state.elements.find((el) => el.id === imageId) as ImageElement | undefined;
      if (!img?.detectedTexts) return;
      const regions = img.detectedTexts.map((r) =>
        r.id === regionId ? { ...r, status } : r,
      );
      state.storeDetections(state.activePageId, imageId, regions);
    },
    [],
  );

  const cancelArmedRegion = useCallback(() => {
    const state = useEditorStore.getState();
    const armedId = state.armedElement?.id;
    if (!armedId) return;
    const canvas = canvasInstanceRef.current;
    if (canvas) {
      const obj = findFabricObjectById(canvas, armedId);
      if (obj) {
        canvas.remove(obj);
        canvas.requestRenderAll();
      }
    }
    state.clearArmedRegion();
  }, [canvasInstanceRef]);

  const syncItextToArmedElement = useCallback(
    (itext: IText) => {
      const store = useEditorStore.getState();
      if (!store.armedElement || store.armedElement.id !== getElementId(itext)) return;
      const updates = extractElementUpdates(itext, 'text') as Partial<TextElement>;
      store.updateArmedElement(updates);
    },
    [],
  );

  const convertArmedElement = useCallback(async () => {
    if (armedConvertingRef.current) return;
    const store = useEditorStore.getState();
    const armedElement = store.armedElement;
    const armedRegionId = store.armedRegionId;
    if (!armedElement || !armedRegionId) return;

    const sourcePageId = store.activePageId;
    const image = store.elements.find(
      (el) => el.type === 'image',
    ) as ImageElement | undefined;
    const region = image?.detectedTexts?.find((r) => r.id === armedRegionId);
    if (!image || !region) return;

    const canvas = canvasInstanceRef.current;
    const itext = canvas
      ? (findFabricObjectById(canvas, armedElement.id) as IText | undefined)
      : undefined;
    if (!itext) return;

    armedConvertingRef.current = true;

    try {
      const result = await convertArmedRegion({
        region,
        sourceImage: image,
        element: armedElement,
        existingMasks: image.textMasks ?? [],
      });

      const state = useEditorStore.getState();
      if (isResultStale(state.pages, sourcePageId, image.id)) return;

      const sourcePage = state.pages.find((p) => p.id === sourcePageId);
      if (!sourcePage) return;

      // Re-read the latest armed element (text/position may have changed
      // during the async inpainting).
      const latest = state.armedElement ?? armedElement;
      const element: TextElement = {
        ...latest,
        opacity: 1,
        visible: true,
        locked: false,
      };

      pushHistoryImmediate(sourcePageId, sourcePage.elements, sourcePage.background);

      useEditorStore.getState().commitArmedConversion(sourcePageId, image.id, {
        element,
        masks: [...(image.textMasks ?? []), ...result.masks],
        maskedImageSrc: result.maskedImageSrc,
        originalSrc: result.originalSrc,
        regionId: region.id,
      });

      if (canvas && state.activePageId === sourcePageId) {
        const fabricImage = findFabricObjectById(canvas, image.id);
        if (fabricImage instanceof FabricImage) {
          try {
            await fabricImage.setSrc(result.maskedImageSrc);
          } catch (err) {
            console.warn('[OCR] failed to swap masked image src', err);
          }
        }
        itext.set({ opacity: 1 });
        canvas.requestRenderAll();
      }

      useEditorStore.getState().markUnsaved();
    } catch (err) {
      console.warn('[OCR] armed conversion failed', err);
    } finally {
      armedConvertingRef.current = false;
    }
  }, [canvasInstanceRef]);

  const armRegion = useCallback(
    async (regionId: string) => {
      const store = useEditorStore.getState();
      const sourcePageId = store.activePageId;
      const image = store.elements.find(
        (el) => el.type === 'image',
      ) as ImageElement | undefined;
      const region = image?.detectedTexts?.find(
        (r) => r.id === regionId && r.status === 'detected',
      );
      if (!region || !image) return;

      // Cancel any previous armed region first.
      cancelArmedRegion();

      const maxZ = Math.max(0, ...store.elements.map((el) => el.zIndex));

      const detected: DetectedText = {
        id: region.id,
        text: region.text,
        confidence: region.confidence,
        polygon: region.polygon.length >= 3 ? region.polygon : undefined,
        boundingBox: region.boundingBox,
      };

      const [base] = convertDetectedTextsToTextElements({
        result: { detectedTexts: [detected] },
        sourceImage: image,
        sourcePageId,
        baseZIndex: maxZ + 1,
        minConfidence: 0,
      });
      if (!base) return;
      if (region.styleEstimate?.color) base.fill = region.styleEstimate.color;
      base.opacity = 0;

      const canvas = canvasInstanceRef.current;
      if (!canvas) return;

      const itext = (await createFabricObject(base)) as IText;
      setElementId(itext, base.id);

      useEditorStore.getState().setArmedRegion(base, region.id);

      canvas.add(itext);
      canvas.setActiveObject(itext);

      itext.on('editing:exited', () => {
        const state = useEditorStore.getState();
        if (state.armedElement?.id === base.id && !armedConvertingRef.current) {
          cancelArmedRegion();
        }
      });

      updateRegionStatus(image.id, region.id, 'armed');

      try {
        itext.enterEditing();
      } catch {
        // best-effort — region stays armed and selectable
      }

      canvas.requestRenderAll();
    },
    [canvasInstanceRef, cancelArmedRegion, updateRegionStatus],
  );

  // RightPanel property edits on the armed element trigger conversion.
  const armedElement = useEditorStore((s) => s.armedElement);
  const armedElementJson = useEditorStore((s) =>
    s.armedElement ? JSON.stringify(s.armedElement) : '',
  );
  const armedBaseJsonRef = useRef<string | null>(null);

  useEffect(() => {
    if (!armedElement) {
      armedBaseJsonRef.current = null;
      return;
    }
    if (armedBaseJsonRef.current === null) {
      armedBaseJsonRef.current = armedElementJson;
      return;
    }
    if (armedElementJson !== armedBaseJsonRef.current) {
      armedBaseJsonRef.current = armedElementJson;
      void convertArmedElement();
    }
  }, [armedElement, armedElementJson, convertArmedElement]);

  useEffect(() => {
    const canvas = canvasInstanceRef.current;
    if (!canvas || !canvasReady) return;

    const handleObjectModified = (e: { target?: FabricObject }) => {
      const target = e.target;
      if (!target) return;
      const store = useEditorStore.getState();
      if (store.armedElement && getElementId(target) === store.armedElement.id) {
        syncItextToArmedElement(target as IText);
        void convertArmedElement();
      }
    };

    const handleTextChanged = (e: { target?: FabricObject }) => {
      const target = e.target;
      if (!target) return;
      const store = useEditorStore.getState();
      if (store.armedElement && getElementId(target) === store.armedElement.id) {
        syncItextToArmedElement(target as IText);
        void convertArmedElement();
      }
    };

    canvas.on('object:modified', handleObjectModified);
    canvas.on('text:changed', handleTextChanged);
    return () => {
      canvas.off('object:modified', handleObjectModified);
      canvas.off('text:changed', handleTextChanged);
    };
  }, [canvasReady, canvasInstanceRef, convertArmedElement, syncItextToArmedElement]);

  useEffect(() => {
    if (!canvasReady || triggeredEditRegion === 0) return;
    const regionId = pendingEditRegionId;
    if (!regionId) return;
    void armRegion(regionId);
  }, [triggeredEditRegion, pendingEditRegionId, canvasReady, armRegion]);

  // Selecting a different detected region cancels an unmodified armed region.
  const selectedDetectedRegionId = useEditorStore((s) => s.selectedDetectedRegionId);
  useEffect(() => {
    const state = useEditorStore.getState();
    if (
      state.armedElement &&
      state.armedRegionId &&
      state.selectedDetectedRegionId &&
      state.selectedDetectedRegionId !== state.armedRegionId
    ) {
      cancelArmedRegion();
    }
  }, [selectedDetectedRegionId, cancelArmedRegion]);

  const convertRegionsFlow = useCallback(
    async (regions: DetectedTextRegion[]) => {
      if (regions.length === 0) return;

      const store = useEditorStore.getState();
      const sourcePageId = store.activePageId;
      const image = store.elements.find(
        (el) => el.type === 'image',
      ) as ImageElement | undefined;
      if (!image) return;

      const baseZIndex =
        Math.max(0, ...store.elements.map((el) => el.zIndex)) + 1;
      const existingMasks = image.textMasks ?? [];

      const result = await convertDetectedRegions({
        regions,
        sourceImage: image,
        sourcePageId,
        baseZIndex,
        existingMasks,
      });

      const state = useEditorStore.getState();
      if (isResultStale(state.pages, sourcePageId, image.id)) return;

      const sourcePage = state.pages.find((p) => p.id === sourcePageId);
      if (!sourcePage) return;

      pushHistoryImmediate(sourcePageId, sourcePage.elements, sourcePage.background);

      const convertedRegionIds = regions.map((r) => r.id);
      useEditorStore.getState().commitRegionConversion(sourcePageId, image.id, {
        maskedImageSrc: result.maskedImageSrc,
        masks: [...existingMasks, ...result.masks],
        elements: result.elements,
        originalSrc: result.originalSrc,
        convertedRegionIds,
      });

      const canvas = canvasInstanceRef.current;
      if (canvas && state.activePageId === sourcePageId) {
        const fabricImage = findFabricObjectById(canvas, image.id);
        if (fabricImage instanceof FabricImage) {
          try {
            await fabricImage.setSrc(result.maskedImageSrc);
          } catch (err) {
            console.warn('[OCR] failed to swap masked image src', err);
          }
        }

        const fabricObjects = await Promise.all(
          result.elements.map(async (el) => {
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

      useEditorStore.getState().markUnsaved();
    },
    [canvasInstanceRef],
  );

  useEffect(() => {
    if (!canvasReady || triggeredConvertAll === 0) return;

    const store = useEditorStore.getState();
    const image = store.elements.find(
      (el) => el.type === 'image',
    ) as ImageElement | undefined;
    const regions = image?.detectedTexts?.filter((r) => r.status === 'detected') ?? [];

    void convertRegionsFlow(regions);
  }, [triggeredConvertAll, canvasReady, convertRegionsFlow]);

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
