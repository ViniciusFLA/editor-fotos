import type { AnyElement, PageBackground } from '@/types';

const MAX_HISTORY = 50;
const DEBOUNCE_MS = 500;

export interface HistorySnapshot {
  elements: AnyElement[];
  pageBackground: PageBackground;
}

interface PageHistory {
  past: HistorySnapshot[];
  future: HistorySnapshot[];
}

const pageHistories = new Map<string, PageHistory>();

let globalDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function getPageHistory(pageId: string): PageHistory {
  let history = pageHistories.get(pageId);
  if (!history) {
    history = { past: [], future: [] };
    pageHistories.set(pageId, history);
  }
  return history;
}

function clearDebounceTimer(): void {
  if (globalDebounceTimer !== null) {
    clearTimeout(globalDebounceTimer);
    globalDebounceTimer = null;
  }
}

export function pushHistoryImmediate(
  pageId: string,
  elements: AnyElement[],
  pageBackground: PageBackground,
): void {
  clearDebounceTimer();

  const history = getPageHistory(pageId);

  history.past.push(structuredClone({ elements, pageBackground }));
  if (history.past.length > MAX_HISTORY) {
    history.past.shift();
  }
  history.future = [];
}

export function pushHistoryDebounced(
  pageId: string,
  elements: AnyElement[],
  pageBackground: PageBackground,
): void {
  const history = getPageHistory(pageId);

  if (globalDebounceTimer === null) {
    history.past.push(structuredClone({ elements, pageBackground }));
    if (history.past.length > MAX_HISTORY) {
      history.past.shift();
    }
    history.future = [];
  }

  clearDebounceTimer();

  globalDebounceTimer = setTimeout(() => {
    globalDebounceTimer = null;
  }, DEBOUNCE_MS);
}

export function undo(
  pageId: string,
  currentSnapshot: HistorySnapshot,
): HistorySnapshot | null {
  const history = getPageHistory(pageId);
  const snapshot = history.past.pop();
  if (!snapshot) return null;

  history.future.push(structuredClone(currentSnapshot));

  return snapshot;
}

export function redo(
  pageId: string,
  currentSnapshot: HistorySnapshot,
): HistorySnapshot | null {
  const history = getPageHistory(pageId);
  const snapshot = history.future.pop();
  if (!snapshot) return null;

  history.past.push(structuredClone(currentSnapshot));

  return snapshot;
}

export function canUndo(pageId: string): boolean {
  const history = pageHistories.get(pageId);
  return history ? history.past.length > 0 : false;
}

export function canRedo(pageId: string): boolean {
  const history = pageHistories.get(pageId);
  return history ? history.future.length > 0 : false;
}

export function clearHistory(pageId?: string): void {
  clearDebounceTimer();

  if (pageId) {
    pageHistories.delete(pageId);
  } else {
    pageHistories.clear();
  }
}
