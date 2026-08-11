'use client';

import { useEffect, useRef } from 'react';
import { useEditorStore } from '@/stores/editor-store';

export function useAutoSave() {
  const elements = useEditorStore((s) => s.elements);
  const pages = useEditorStore((s) => s.pages);
  const pageBackground = useEditorStore((s) => s.pageBackground);
  const projectName = useEditorStore((s) => s.projectName);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const store = useEditorStore.getState();
    if (store.saveStatus === 'saving') return;
    if (store.cropModeElementId !== null) return;

    if (store.saveStatus !== 'unsaved') {
      store.markUnsaved();
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      useEditorStore.getState().saveProject();
    }, 2000);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [elements, pages, pageBackground, projectName]);
}
