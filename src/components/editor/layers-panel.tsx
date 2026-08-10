'use client';

import { useMemo, useCallback, useState } from 'react';
import {
  Square,
  Type,
  ImageIcon,
  Group,
  ChevronUp,
  ChevronDown,
  ChevronsUp,
  ChevronsDown,
} from 'lucide-react';
import { useEditorStore } from '@/stores/editor-store';
import { pushHistoryImmediate } from '@/editor/history/history-manager';
import type { AnyElement, GroupElement } from '@/types';

const typeIcons: Record<string, typeof Square> = {
  text: Type,
  image: ImageIcon,
  shape: Square,
  group: Group,
};

export function LayersPanel() {
  const elements = useEditorStore((s) => s.elements);
  const selectedElementIds = useEditorStore((s) => s.selectedElementIds);
  const setSelectedElementIds = useEditorStore((s) => s.setSelectedElementIds);
  const updateElement = useEditorStore((s) => s.updateElement);
  const bringForward = useEditorStore((s) => s.bringForward);
  const sendBackward = useEditorStore((s) => s.sendBackward);
  const bringToFront = useEditorStore((s) => s.bringToFront);
  const sendToBack = useEditorStore((s) => s.sendToBack);
  const reorderElementsByZIndex = useEditorStore((s) => s.reorderElementsByZIndex);

  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const sorted = useMemo(() => {
    return [...elements].sort((a, b) => b.zIndex - a.zIndex);
  }, [elements]);

  const selectedId = selectedElementIds[0];

  const handleSelect = useCallback(
    (id: string) => {
      setSelectedElementIds([id]);
    },
    [setSelectedElementIds],
  );

  const handleToggleVisible = useCallback(
    (el: AnyElement, e: React.MouseEvent) => {
      e.stopPropagation();
      updateElement(el.id, { visible: !el.visible });
    },
    [updateElement],
  );

  const handleToggleLocked = useCallback(
    (el: AnyElement, e: React.MouseEvent) => {
      e.stopPropagation();
      updateElement(el.id, { locked: !el.locked });
    },
    [updateElement],
  );

  const handleDragStart = useCallback(
    (e: React.DragEvent, id: string) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', id);
    },
    [],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDragOverIndex(index);
    },
    [],
  );

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, toIndex: number) => {
      e.preventDefault();
      setDragOverIndex(null);

      const draggedId = e.dataTransfer.getData('text/plain');
      if (!draggedId) return;

      const currentSorted = [...useEditorStore.getState().elements].sort(
        (a, b) => b.zIndex - a.zIndex,
      );

      const fromIndex = currentSorted.findIndex((el) => el.id === draggedId);
      if (fromIndex < 0 || fromIndex === toIndex) return;

      const newOrder = [...currentSorted];
      const [removed] = newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, removed!);

      pushHistoryImmediate(useEditorStore.getState().elements);

      reorderElementsByZIndex(newOrder.map((el) => el.id));
    },
    [reorderElementsByZIndex],
  );

  if (sorted.length === 0) {
    return (
      <div className='flex w-48 flex-col border-r bg-card shrink-0'>
        <div className='flex h-10 items-center border-b px-3'>
          <span className='text-xs font-medium text-muted-foreground'>
            Layers
          </span>
        </div>
        <div className='flex flex-1 items-center justify-center'>
          <span className='text-xs text-muted-foreground'>No layers</span>
        </div>
      </div>
    );
  }

  return (
    <div className='flex w-48 flex-col border-r bg-card shrink-0'>
      <div className='flex h-10 items-center justify-between border-b px-2'>
        <span className='text-xs font-medium text-muted-foreground'>
          Layers
        </span>
      </div>

      <div className='flex items-center justify-center gap-0.5 border-b px-1 py-0.5'>
        <button
          onClick={() => {
            if (!selectedId) return;
            pushHistoryImmediate(useEditorStore.getState().elements);
            bringToFront(selectedId);
          }}
          disabled={!selectedId}
          className='flex h-5 w-5 items-center justify-center rounded hover:bg-muted disabled:opacity-30'
          title='Bring to Front'
        >
          <ChevronsUp className='h-3 w-3 text-muted-foreground' />
        </button>
        <button
          onClick={() => {
            if (!selectedId) return;
            pushHistoryImmediate(useEditorStore.getState().elements);
            bringForward(selectedId);
          }}
          disabled={!selectedId}
          className='flex h-5 w-5 items-center justify-center rounded hover:bg-muted disabled:opacity-30'
          title='Bring Forward'
        >
          <ChevronUp className='h-3 w-3 text-muted-foreground' />
        </button>
        <button
          onClick={() => {
            if (!selectedId) return;
            pushHistoryImmediate(useEditorStore.getState().elements);
            sendBackward(selectedId);
          }}
          disabled={!selectedId}
          className='flex h-5 w-5 items-center justify-center rounded hover:bg-muted disabled:opacity-30'
          title='Send Backward'
        >
          <ChevronDown className='h-3 w-3 text-muted-foreground' />
        </button>
        <button
          onClick={() => {
            if (!selectedId) return;
            pushHistoryImmediate(useEditorStore.getState().elements);
            sendToBack(selectedId);
          }}
          disabled={!selectedId}
          className='flex h-5 w-5 items-center justify-center rounded hover:bg-muted disabled:opacity-30'
          title='Send to Back'
        >
          <ChevronsDown className='h-3 w-3 text-muted-foreground' />
        </button>
      </div>

      <div
        className='flex flex-1 flex-col overflow-y-auto'
        onDragLeave={handleDragLeave}
      >
        {sorted.map((el, i) => {
          const isSelected = el.id === selectedId;
          const isDragOver = dragOverIndex === i;
          const Icon = typeIcons[el.type] ?? Square;

          return (
            <button
              key={el.id}
              draggable
              onClick={() => handleSelect(el.id)}
              onDragStart={(e) => handleDragStart(e, el.id)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDrop={(e) => handleDrop(e, i)}
              className={`flex items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors ${
                isDragOver ? 'border-t-2 border-blue-400' : ''
              } ${
                isSelected
                  ? 'bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-100'
                  : 'hover:bg-muted/50'
              }`}
            >
              <Icon
                className={`h-3.5 w-3.5 shrink-0 ${
                  isSelected ? 'text-blue-600' : 'text-muted-foreground'
                }`}
              />

              <span
                className={`flex-1 truncate ${
                  !el.visible ? 'opacity-40' : ''
                } ${isSelected ? 'font-medium' : ''}`}
              >
                {el.name}
                {el.type === 'group' && (
                  <span className='ml-1 text-muted-foreground'>
                    ({(el as GroupElement).childElements.length})
                  </span>
                )}
              </span>

              <span
                role='button'
                tabIndex={-1}
                onClick={(e) => handleToggleVisible(el, e)}
                className={`flex h-5 w-5 items-center justify-center rounded text-[11px] leading-none shrink-0 ${
                  el.visible
                    ? 'text-muted-foreground hover:text-foreground'
                    : 'text-muted-foreground/30 hover:text-muted-foreground'
                }`}
                title={el.visible ? 'Hide' : 'Show'}
              >
                {el.visible ? (
                  <svg
                    width='14'
                    height='14'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth='2'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                  >
                    <path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z' />
                    <circle cx='12' cy='12' r='3' />
                  </svg>
                ) : (
                  <svg
                    width='14'
                    height='14'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth='2'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                  >
                    <path d='M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94' />
                    <path d='M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19' />
                    <line x1='1' y1='1' x2='23' y2='23' />
                  </svg>
                )}
              </span>

              <span
                role='button'
                tabIndex={-1}
                onClick={(e) => handleToggleLocked(el, e)}
                className='flex h-5 w-5 items-center justify-center text-[11px] shrink-0'
                title={el.locked ? 'Unlock' : 'Lock'}
              >
                {el.locked ? (
                  <svg
                    width='12'
                    height='12'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth='2'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    className='text-amber-500'
                  >
                    <rect x='3' y='11' width='18' height='11' rx='2' ry='2' />
                    <path d='M7 11V7a5 5 0 0 1 10 0v4' />
                  </svg>
                ) : (
                  <svg
                    width='12'
                    height='12'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth='2'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    className='text-muted-foreground/30 hover:text-muted-foreground'
                  >
                    <rect x='3' y='11' width='18' height='11' rx='2' ry='2' />
                    <path d='M7 11V7a5 5 0 0 1 9.9-1' />
                  </svg>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
