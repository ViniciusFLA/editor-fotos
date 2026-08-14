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
import type { ImageElement, ShapeType } from '@/types';
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
  const triggerConvertAll = useEditorStore((s) => s.triggerConvertAll);
  const triggerConvertRegion = useEditorStore((s) => s.triggerConvertRegion);
  const selectedDetectedRegionId = useEditorStore((s) => s.selectedDetectedRegionId);

  const selectedRegion = useEditorStore((s) => {
    if (!s.selectedDetectedRegionId) return null;
    for (const el of s.elements) {
      if (el.type === 'image') {
        const region = (el as ImageElement).detectedTexts?.find(
          (r) => r.id === s.selectedDetectedRegionId && r.status === 'detected',
        );
        // Return the region object itself (stable reference) — returning a new
        // wrapper object here would cause an infinite update loop.
        if (region) return region;
      }
    }
    return null;
  });

  const hasDetectedRegions = useEditorStore((s) =>
    s.elements.some(
      (el) =>
        el.type === 'image' &&
        ((el as ImageElement).detectedTexts?.some((r) => r.status === 'detected') ?? false),
    ),
  );

  const handleConvertRegion = useCallback(() => {
    if (selectedDetectedRegionId) triggerConvertRegion(selectedDetectedRegionId);
  }, [selectedDetectedRegionId, triggerConvertRegion]);

  const handleIgnoreRegion = useCallback(() => {
    if (!selectedRegion) return;
    const state = useEditorStore.getState();
    const img = state.elements.find(
      (el) =>
        el.type === 'image' &&
        ((el as ImageElement).detectedTexts?.some((r) => r.id === selectedRegion.id) ?? false),
    ) as ImageElement | undefined;
    if (!img?.detectedTexts) return;
    const regions = img.detectedTexts.map((r) =>
      r.id === selectedRegion.id ? { ...r, status: 'rejected' as const } : r,
    );
    state.storeDetections(state.activePageId, img.id, regions);
    state.setSelectedDetectedRegionId(null);
  }, [selectedRegion]);

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

          {hasDetectedRegions && (
            <button
              onClick={() => triggerConvertAll()}
              className='mt-2 flex w-full items-center justify-center gap-2 rounded px-3 py-1.5 text-[11px] font-medium bg-muted hover:bg-muted/80 text-foreground transition-colors'
            >
              {t('editor.ai.convertAll')}
            </button>
          )}

          {selectedRegion && (
            <div className='mt-2 rounded border border-border bg-background p-2'>
              <p className='text-[11px] font-medium leading-tight'>
                {selectedRegion.text}
              </p>
              <p className='mt-0.5 text-[10px] leading-tight text-muted-foreground'>
                {t('editor.ai.confidence').replace(
                  '{value}',
                  String(Math.round(selectedRegion.confidence * 100)),
                )}
              </p>
              <div className='mt-1.5 flex gap-1'>
                <button
                  onClick={handleConvertRegion}
                  className='flex-1 rounded bg-blue-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-blue-700 transition-colors'
                >
                  {t('editor.ai.editText')}
                </button>
                <button
                  onClick={handleIgnoreRegion}
                  className='flex-1 rounded bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-muted/80 transition-colors'
                >
                  {t('editor.ai.ignore')}
                </button>
              </div>
            </div>
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
