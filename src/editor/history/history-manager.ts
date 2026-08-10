import type { AnyElement } from '@/types';

const MAX_HISTORY = 50;

const past: AnyElement[][] = [];
let future: AnyElement[][] = [];
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export function pushHistoryImmediate(elements: AnyElement[]): void {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  past.push(structuredClone(elements));
  if (past.length > MAX_HISTORY) {
    past.shift();
  }
  future = [];
}

export function pushHistoryDebounced(elements: AnyElement[]): void {
  if (debounceTimer === null) {
    past.push(structuredClone(elements));
    if (past.length > MAX_HISTORY) {
      past.shift();
    }
    future = [];
  }

  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
  }, 500);
}

export function undo(currentElements: AnyElement[]): AnyElement[] | null {
  const snapshot = past.pop();
  if (!snapshot) return null;

  future.push(structuredClone(currentElements));

  return snapshot;
}

export function redo(currentElements: AnyElement[]): AnyElement[] | null {
  const snapshot = future.pop();
  if (!snapshot) return null;

  past.push(structuredClone(currentElements));

  return snapshot;
}

export function canUndo(): boolean {
  return past.length > 0;
}

export function canRedo(): boolean {
  return future.length > 0;
}
