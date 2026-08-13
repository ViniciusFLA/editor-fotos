'use client';

import { useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Upload,
  Type,
  Square,
  ImageIcon,
  Layers,
  Sparkles,
  RectangleHorizontal,
  Circle,
  Minus,
} from 'lucide-react';
import { useEditorStore } from '@/stores/editor-store';
import { validateImageFile } from '@/lib/image-validation';
import { useTranslation } from '@/i18n';
import type { ShapeType } from '@/types';
const tabs = [
  { id: 'uploads', icon: Upload, labelKey: 'editor.sidebar.uploads' as const },
  { id: 'text', icon: Type, labelKey: 'editor.sidebar.text' as const },
  { id: 'elements', icon: Square, labelKey: 'editor.sidebar.elements' as const },
  { id: 'images', icon: ImageIcon, labelKey: 'editor.sidebar.images' as const },
  { id: 'layers', icon: Layers, labelKey: 'editor.sidebar.layers' as const },
  { id: 'ai', icon: Sparkles, labelKey: 'editor.sidebar.ai' as const },
] as const;

const shapeOptions: { icon: React.ComponentType<{ className?: string }>; type: ShapeType; labelKey: string }[] = [
  { icon: RectangleHorizontal, type: 'rectangle', labelKey: 'editor.sidebar.shapes.rectangle' },
  { icon: Circle, type: 'circle', labelKey: 'editor.sidebar.shapes.circle' },
  { icon: Minus, type: 'line', labelKey: 'editor.sidebar.shapes.line' },
];

export function LeftSidebar() {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const setPendingImageSrc = useEditorStore((s) => s.setPendingImageSrc);
  const setUploadError = useEditorStore((s) => s.setUploadError);
  const uploadError = useEditorStore((s) => s.uploadError);
  const triggerTextAdd = useEditorStore((s) => s.triggerTextAdd);
  const triggerShapeAdd = useEditorStore((s) => s.triggerShapeAdd);
  const activeSidebarTab = useEditorStore((s) => s.activeSidebarTab);
  const setActiveSidebarTab = useEditorStore((s) => s.setActiveSidebarTab);
  const selectedElementIds = useEditorStore((s) => s.selectedElementIds);
  const elements = useEditorStore((s) => s.elements);
  const ocrStatus = useEditorStore((s) => s.ocrStatus);
  const ocrDetectedCount = useEditorStore((s) => s.ocrDetectedCount);
  const ocrError = useEditorStore((s) => s.ocrError);
  const triggerOcrDetect = useEditorStore((s) => s.triggerOcrDetect);

  const hasSingleImageSelected =
    selectedElementIds.length === 1 &&
    elements.some(
      (el) => el.id === selectedElementIds[0] && el.type === 'image',
    );

  const handleTabClick = useCallback(
    (tabId: string) => {
      if (tabId === 'uploads') {
        fileInputRef.current?.click();
        setActiveSidebarTab(null);
        return;
      }
      if (tabId === 'text') {
        triggerTextAdd();
        setActiveSidebarTab(null);
        return;
      }
      if (tabId === 'elements') {
        setActiveSidebarTab(
          activeSidebarTab === 'elements' ? null : 'elements',
        );
        return;
      }
      if (tabId === 'layers') {
        setActiveSidebarTab(activeSidebarTab === 'layers' ? null : 'layers');
        return;
      }
      if (tabId === 'ai') {
        setActiveSidebarTab(activeSidebarTab === 'ai' ? null : 'ai');
        return;
      }
      setActiveSidebarTab(null);
    },
    [
      triggerTextAdd,
      activeSidebarTab,
      setActiveSidebarTab,
    ],
  );

  const handleShapeClick = useCallback(
    (shapeType: ShapeType) => {
      triggerShapeAdd(shapeType);
      setActiveSidebarTab(null);
    },
    [triggerShapeAdd, setActiveSidebarTab],
  );

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const error = validateImageFile(file);
      if (error) {
        setUploadError(error);
        event.target.value = '';
        return;
      }

      setUploadError(null);

      const objectUrl = URL.createObjectURL(file);

      const previousSrc = useEditorStore.getState().pendingImageSrc;
      if (previousSrc) {
        URL.revokeObjectURL(previousSrc);
      }

      setPendingImageSrc(objectUrl);

      event.target.value = '';
    },
    [setPendingImageSrc, setUploadError],
  );

  return (
    <aside className='flex w-12 flex-col border-r bg-card shrink-0 relative'>
      <input
        ref={fileInputRef}
        type='file'
        accept='image/png,image/jpeg,image/webp'
        className='hidden'
        onChange={handleFileChange}
      />

      {tabs.map((tab) => {
        const isActive = activeSidebarTab === tab.id;

        return (
          <Button
            key={tab.id}
            variant='ghost'
            size='icon'
            className={`h-10 w-12 rounded-none ${isActive ? 'bg-muted' : ''}`}
            title={
              uploadError && tab.id === 'uploads' ? uploadError : t(tab.labelKey)
            }
            onClick={() => handleTabClick(tab.id)}
          >
            <tab.icon
              className={`h-4 w-4 ${
                uploadError && tab.id === 'uploads'
                  ? 'text-destructive'
                  : isActive
                    ? 'text-foreground'
                    : 'text-muted-foreground'
              }`}
            />
          </Button>
        );
      })}

      {activeSidebarTab === 'elements' && (
        <div className='absolute left-full top-[120px] ml-1 bg-card border rounded shadow-lg z-50 py-1'>
          {shapeOptions.map((opt) => (
            <button
              key={opt.type}
              className='flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-muted text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap'
              onClick={() => handleShapeClick(opt.type)}
              title={t(opt.labelKey)}
            >
              <opt.icon className='h-3.5 w-3.5' />
              <span>{t(opt.labelKey)}</span>
            </button>
          ))}
        </div>
      )}

      {activeSidebarTab === 'ai' && (
        <div className='absolute left-full top-[120px] ml-1 w-56 bg-card border rounded shadow-lg z-50 p-2'>
          <button
            onClick={() => triggerOcrDetect()}
            disabled={!hasSingleImageSelected || ocrStatus === 'loading'}
            className='flex w-full items-center justify-center gap-2 rounded px-3 py-2 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
          >
            {ocrStatus === 'loading'
              ? t('editor.ai.detecting')
              : t('editor.ai.detectText')}
          </button>

          {!hasSingleImageSelected && ocrStatus !== 'loading' && (
            <p className='mt-2 text-[10px] leading-tight text-muted-foreground'>
              {t('editor.ai.selectImageHint')}
            </p>
          )}

          {ocrStatus === 'success' && (
            <p className='mt-2 text-[10px] leading-tight text-green-600'>
              {t('editor.ai.detected').replace('{count}', String(ocrDetectedCount))}
            </p>
          )}

          {ocrStatus === 'error' && (
            <p className='mt-2 text-[10px] leading-tight text-destructive'>
              {t(
                ocrError === 'requiresSingleImage' ||
                  ocrError === 'imageFetchFailed' ||
                  ocrError === 'httpError' ||
                  ocrError === 'serviceUnavailable' ||
                  ocrError === 'pageRemoved' ||
                  ocrError === 'imageRemoved' ||
                  ocrError === 'alreadyProcessed' ||
                  ocrError === 'noTextDetected' ||
                  ocrError === 'allDetectionsFiltered' ||
                  ocrError === 'inpaintingFailed' ||
                  ocrError === 'staleResult'
                  ? `editor.ai.error.${ocrError}`
                  : 'editor.ai.error.unknown',
              )}
            </p>
          )}
        </div>
      )}
    </aside>
  );
}
