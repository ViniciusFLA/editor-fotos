'use client';

import { useEffect, useCallback } from 'react';
import type { Canvas, FabricObject } from 'fabric';
import { Group, ActiveSelection } from 'fabric';
import { useEditorStore } from '@/stores/editor-store';
import {
  findFabricObjectById,
  createFabricObject,
  setElementId,
} from '@/editor/core/element-factory';
import {
  pushHistoryImmediate,
  pushHistoryDebounced,
  undo,
  redo,
} from '@/editor/history/history-manager';
import { generateId, deepCloneElementWithNewIds } from '@/utils';
import { restoreMasksForDeletedTexts } from '@/editor/masks/mask-restore';
import type { AnyElement, GroupElement } from '@/types';

interface UseKeyboardShortcutsParams {
  canvasInstanceRef: React.MutableRefObject<Canvas | null>;
  isTextEditingRef: React.MutableRefObject<boolean>;
  containerRef: React.MutableRefObject<HTMLDivElement | null>;
}

export function useKeyboardShortcuts({
  canvasInstanceRef,
  isTextEditingRef,
  containerRef,
}: UseKeyboardShortcutsParams) {
  const handleDelete = useCallback(() => {
    if (isTextEditingRef.current) return;

    const canvas = canvasInstanceRef.current;
    if (!canvas) return;

    const store = useEditorStore.getState();
    const ids = store.selectedElementIds;
    if (ids.length === 0) return;

    pushHistoryImmediate(store.activePageId, store.elements, store.pageBackground);

    ids.forEach((id) => {
      const obj = findFabricObjectById(canvas, id);
      if (obj) {
        canvas.remove(obj);
      }
    });

    canvas.discardActiveObject();
    canvas.requestRenderAll();

    ids.forEach((id) => store.removeElement(id));

    // ETAPA 34 — deleting an OCR text layer restores its linked mask.
    void restoreMasksForDeletedTexts(ids);
  }, [canvasInstanceRef, isTextEditingRef]);

  const handleDuplicate = useCallback(() => {
    if (isTextEditingRef.current) return;

    const canvas = canvasInstanceRef.current;
    if (!canvas) return;

    const store = useEditorStore.getState();
    const ids = store.selectedElementIds;
    if (ids.length === 0) return;

    pushHistoryImmediate(store.activePageId, store.elements, store.pageBackground);

    const nextZIndex =
      Math.max(0, ...store.elements.map((el) => el.zIndex)) + 1;

    ids.forEach((id) => {
      const el = store.elements.find((e) => e.id === id);
      const originalObj = el ? findFabricObjectById(canvas, id) : undefined;
      if (!el || !originalObj) return;

      const cloned = deepCloneElementWithNewIds(el);
      cloned.name = `${el.name} copy`;
      cloned.x = el.x + 15;
      cloned.y = el.y + 15;
      cloned.zIndex = nextZIndex + ids.indexOf(id);

      originalObj.clone().then((clonedObj) => {
        clonedObj.set({
          left: cloned.x,
          top: cloned.y,
        });
        setElementId(clonedObj, cloned.id);
        canvas.add(clonedObj);
        canvas.requestRenderAll();

        store.addElement(cloned);
      });
    });
  }, [canvasInstanceRef, isTextEditingRef]);

  const handleUndo = useCallback(() => {
    if (isTextEditingRef.current) return;

    const store = useEditorStore.getState();
    const selectedIds = store.selectedElementIds;
    const restored = undo(store.activePageId, {
      elements: store.elements,
      pageBackground: store.pageBackground,
    });
    if (!restored) return;

    store.setElements(restored.elements);
    store.setPageBackground(restored.pageBackground);

    const validIds = selectedIds.filter((id) =>
      restored.elements.some((el) => el.id === id),
    );
    store.setSelectedElementIds(validIds);

    store.triggerRebuildCanvas();
  }, [isTextEditingRef]);

  const handleRedo = useCallback(() => {
    if (isTextEditingRef.current) return;

    const store = useEditorStore.getState();
    const selectedIds = store.selectedElementIds;
    const restored = redo(store.activePageId, {
      elements: store.elements,
      pageBackground: store.pageBackground,
    });
    if (!restored) return;

    store.setElements(restored.elements);
    store.setPageBackground(restored.pageBackground);

    const validIds = selectedIds.filter((id) =>
      restored.elements.some((el) => el.id === id),
    );
    store.setSelectedElementIds(validIds);

    store.triggerRebuildCanvas();
  }, [isTextEditingRef]);

  const handleCopy = useCallback(() => {
    useEditorStore.getState().copyToClipboard();
  }, []);

  const handleCut = useCallback(() => {
    handleCopy();
    handleDelete();
  }, [handleCopy, handleDelete]);

  const handlePaste = useCallback(() => {
    if (isTextEditingRef.current) return;

    const canvas = canvasInstanceRef.current;
    if (!canvas) return;

    const store = useEditorStore.getState();
    const clipboard = store.clipboard;
    if (clipboard.length === 0) return;

    pushHistoryImmediate(store.activePageId, store.elements, store.pageBackground);

    const offset = store.pasteOffset * 15;
    const nextZIndex =
      Math.max(0, ...store.elements.map((el) => el.zIndex)) + 1;

    const pasteOperations = clipboard.map(async (el, i) => {
      const newId = generateId();
      const base = deepCloneElementWithNewIds(el);
      const newEl = {
        ...base,
        id: newId,
        x: el.x + offset,
        y: el.y + offset,
        zIndex: nextZIndex + i,
      } as AnyElement;

      const fabricObj = await createFabricObject(newEl);

      setElementId(fabricObj, newId);
      canvas.add(fabricObj);

      return newEl as AnyElement;
    });

    Promise.all(pasteOperations).then((newElements) => {
      newElements.forEach((newEl) => {
        store.addElement(newEl);
      });
      canvas.requestRenderAll();
      store.incrementPasteOffset();
    });
  }, [canvasInstanceRef, isTextEditingRef]);

  const handleArrowMove = useCallback(
    (key: string, shiftKey: boolean) => {
      if (isTextEditingRef.current) return;

      const canvas = canvasInstanceRef.current;
      if (!canvas) return;

      const store = useEditorStore.getState();
      const ids = store.selectedElementIds;
      if (ids.length === 0) return;

      const STEP = shiftKey ? 10 : 1;

      let dx = 0;
      let dy = 0;

      if (key === 'ArrowUp') dy = -STEP;
      else if (key === 'ArrowDown') dy = STEP;
      else if (key === 'ArrowLeft') dx = -STEP;
      else if (key === 'ArrowRight') dx = STEP;
      else return;

      pushHistoryDebounced(store.activePageId, store.elements, store.pageBackground);

      ids.forEach((id) => {
        const el = store.elements.find((e) => e.id === id);
        if (!el || el.locked) return;

        const obj = findFabricObjectById(canvas, id);
        if (!obj) return;

        obj.set({
          left: (obj.left ?? 0) + dx,
          top: (obj.top ?? 0) + dy,
        });

        store.updateElement(id, { x: el.x + dx, y: el.y + dy });
      });

      canvas.requestRenderAll();
    },
    [canvasInstanceRef, isTextEditingRef],
  );

  const handleGroup = useCallback(() => {
    if (isTextEditingRef.current) return;

    const canvas = canvasInstanceRef.current;
    if (!canvas) return;

    const store = useEditorStore.getState();
    const selectedIds = store.selectedElementIds;
    if (selectedIds.length < 2) return;

    const childObjs = (
      selectedIds.map((id) => findFabricObjectById(canvas, id)).filter(Boolean) as FabricObject[]
    );
    if (childObjs.length < 2) return;

    pushHistoryImmediate(store.activePageId, store.elements, store.pageBackground);

    const groupId = generateId();
    const group = new Group(childObjs, {
      subTargetCheck: false,
    });

    childObjs.forEach((obj) => {
      canvas.remove(obj);
    });

    canvas.add(group);

    const bounds = group.getBoundingRect();
    const nextZIndex =
      Math.max(0, ...store.elements.map((el) => el.zIndex)) + 1;

    const childElements = selectedIds
      .map((id) => store.elements.find((e) => e.id === id))
      .filter(Boolean) as AnyElement[];

    const groupElement: GroupElement = {
      id: groupId,
      type: 'group',
      name: 'Group',
      x: group.left ?? bounds.left,
      y: group.top ?? bounds.top,
      width: group.width ?? bounds.width,
      height: group.height ?? bounds.height,
      scaleX: group.scaleX ?? 1,
      scaleY: group.scaleY ?? 1,
      rotation: group.angle ?? 0,
      opacity: 1,
      visible: true,
      locked: false,
      zIndex: nextZIndex,
      childElements,
    };

    setElementId(group, groupId);

    store.groupSelected(groupElement, selectedIds);

    canvas.setActiveObject(group);
    canvas.requestRenderAll();
  }, [canvasInstanceRef, isTextEditingRef]);

  const handleUngroup = useCallback(() => {
    if (isTextEditingRef.current) return;

    const canvas = canvasInstanceRef.current;
    if (!canvas) return;

    const store = useEditorStore.getState();
    const selectedId = store.selectedElementIds[0];
    if (!selectedId) return;

    const groupEl = store.elements.find((e) => e.id === selectedId);
    if (!groupEl || groupEl.type !== 'group') return;

    pushHistoryImmediate(store.activePageId, store.elements, store.pageBackground);

    const groupObj = findFabricObjectById(canvas, selectedId);
    if (!groupObj || !(groupObj instanceof Group)) return;

    const childObjs = groupObj.getObjects();
    const childElements = (groupEl as GroupElement).childElements;

    const updatedChildren: AnyElement[] = childObjs.map((childObj, i) => {
      const childEl = childElements[i];
      if (!childEl) return null;

      setElementId(childObj, childEl.id);

      return {
        ...childEl,
        x: childObj.left ?? childEl.x,
        y: childObj.top ?? childEl.y,
        width: childObj.width ?? childEl.width,
        height: childObj.height ?? childObj.height,
        scaleX: childObj.scaleX ?? childEl.scaleX,
        scaleY: childObj.scaleY ?? childEl.scaleY,
        rotation: childObj.angle ?? childEl.rotation,
      } as AnyElement;
    }).filter(Boolean) as AnyElement[];

    canvas.remove(groupObj);

    childObjs.forEach((childObj) => {
      canvas.add(childObj);
    });

    store.ungroupSelected(selectedId, updatedChildren);

    if (updatedChildren.length > 0) {
      const objs = (
        updatedChildren
          .map((c) => findFabricObjectById(canvas, c.id))
          .filter(Boolean) as FabricObject[]
      );

      if (objs.length === 1) {
        canvas.setActiveObject(objs[0]!);
      } else if (objs.length > 1) {
        canvas.setActiveObject(
          new ActiveSelection(objs, { canvas }),
        );
      }
    }

    canvas.requestRenderAll();
  }, [canvasInstanceRef, isTextEditingRef]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
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

      if (isCtrl && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        handleUndo();
        return;
      }

      if (isCtrl && e.shiftKey && e.key === 'Z') {
        e.preventDefault();
        handleRedo();
        return;
      }

      if (isCtrl && e.key === 'c') {
        e.preventDefault();
        handleCopy();
        return;
      }

      if (isCtrl && e.key === 'v') {
        e.preventDefault();
        handlePaste();
        return;
      }

      if (isCtrl && e.key === 'x') {
        e.preventDefault();
        handleCut();
        return;
      }

      if (isCtrl && e.key === 'g' && !e.shiftKey) {
        e.preventDefault();
        handleGroup();
        return;
      }

      if (isCtrl && e.shiftKey && e.key === 'G') {
        e.preventDefault();
        handleUngroup();
        return;
      }

      if (
        e.key === 'ArrowUp' ||
        e.key === 'ArrowDown' ||
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowRight'
      ) {
        e.preventDefault();
        handleArrowMove(e.key, e.shiftKey);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleDelete,
    handleDuplicate,
    handleUndo,
    handleRedo,
    handleCopy,
    handleCut,
    handlePaste,
    handleArrowMove,
    handleGroup,
    handleUngroup,
    isTextEditingRef,
  ]);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      if (!isCtrl) return;

      e.preventDefault();

      const store = useEditorStore.getState();

      if (e.deltaY < 0) {
        store.zoomIn();
      } else {
        store.zoomOut();
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
    }

    return () => {
      if (container) {
        container.removeEventListener('wheel', handleWheel);
      }
    };
  }, [containerRef]);

  return {
    handleUndo,
    handleRedo,
    handleGroup,
    handleUngroup,
    handleDelete,
    handleDuplicate,
    handleCopy,
    handlePaste,
    handleCut,
  };
}
