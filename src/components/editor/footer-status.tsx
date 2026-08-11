'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Plus, X } from 'lucide-react';
import { useEditorStore } from '@/stores/editor-store';
import { useTranslation } from '@/i18n';

interface FormatPreset {
  label: string;
  width: number;
  height: number;
}

const FORMAT_PRESETS: FormatPreset[] = [
  { label: 'Instagram Square', width: 1080, height: 1080 },
  { label: 'Instagram Portrait', width: 1080, height: 1350 },
  { label: 'Stories / Reels', width: 1080, height: 1920 },
  { label: 'Facebook Landscape', width: 1200, height: 628 },
  { label: 'YouTube Thumbnail', width: 1280, height: 720 },
];

export function FooterStatus() {
  const { t } = useTranslation();
  const zoom = useEditorStore((s) => s.zoom);
  const zoomIn = useEditorStore((s) => s.zoomIn);
  const zoomOut = useEditorStore((s) => s.zoomOut);
  const zoomReset = useEditorStore((s) => s.zoomReset);
  const pages = useEditorStore((s) => s.pages);
  const activePageId = useEditorStore((s) => s.activePageId);
  const setActivePage = useEditorStore((s) => s.setActivePage);
  const createPage = useEditorStore((s) => s.createPage);
  const deletePage = useEditorStore((s) => s.deletePage);
  const renamePage = useEditorStore((s) => s.renamePage);

  const zoomPercent = Math.round(zoom * 100);
  const isMinZoom = zoom <= 0.1;
  const isMaxZoom = zoom >= 4.0;

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  const [showPresets, setShowPresets] = useState(false);
  const [customWidth, setCustomWidth] = useState('1080');
  const [customHeight, setCustomHeight] = useState('1080');
  const presetsRef = useRef<HTMLDivElement>(null);
  const addBtnRef = useRef<HTMLButtonElement>(null);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const confirmRef = useRef<HTMLDivElement>(null);

  const activePage = pages.find((p) => p.id === activePageId);

  const startRename = useCallback((id: string, name: string) => {
    setRenamingId(id);
    setRenameValue(name);
  }, []);

  const commitRename = useCallback(() => {
    if (renamingId && renameValue.trim()) {
      renamePage(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  }, [renamingId, renameValue, renamePage]);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        confirmDeleteId &&
        confirmRef.current &&
        !confirmRef.current.contains(e.target as Node)
      ) {
        setConfirmDeleteId(null);
      }
    };

    if (confirmDeleteId) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [confirmDeleteId]);

  const confirmDeletePage = useCallback(() => {
    if (confirmDeleteId) {
      deletePage(confirmDeleteId);
      setConfirmDeleteId(null);
    }
  }, [confirmDeleteId, deletePage]);

  const handleSelectPreset = useCallback(
    (w: number, h: number) => {
      createPage(w, h, `${t('pageDefault')} ${pages.length + 1}`);
      setShowPresets(false);
    },
    [createPage, t, pages.length],
  );

  const handleCustomCreate = useCallback(() => {
    const w = parseInt(customWidth);
    const h = parseInt(customHeight);
    if (w > 0 && h > 0) {
      createPage(w, h, `${t('pageDefault')} ${pages.length + 1}`);
      setShowPresets(false);
    }
  }, [customWidth, customHeight, createPage, t, pages.length]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        showPresets &&
        presetsRef.current &&
        !presetsRef.current.contains(e.target as Node) &&
        addBtnRef.current &&
        !addBtnRef.current.contains(e.target as Node)
      ) {
        setShowPresets(false);
      }
    };

    if (showPresets) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPresets]);

  return (
    <footer className='flex h-7 items-center justify-between border-t bg-card pl-2 pr-4 shrink-0 relative'>
      <div className='flex items-center gap-0.5 min-w-0'>
        {pages.map((page) => (
          <div
            key={page.id}
            className={`group flex items-center h-6 rounded px-1.5 text-[11px] cursor-pointer shrink-0 transition-colors ${
              page.id === activePageId
                ? 'bg-muted text-foreground font-medium'
                : 'text-muted-foreground hover:bg-muted/50'
            }`}
            onClick={() => {
              if (renamingId) return;
              setActivePage(page.id);
            }}
          >
            {renamingId === page.id ? (
              <input
                ref={renameInputRef}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') setRenamingId(null);
                }}
                className='w-20 h-4 bg-background border border-ring rounded px-1 text-[11px] focus:outline-none'
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  startRename(page.id, page.name);
                }}
              >
                {page.name}
              </span>
            )}
            {pages.length > 1 && page.id !== activePageId && !renamingId && (
              <button
                className='ml-0.5 hidden group-hover:flex items-center justify-center h-3.5 w-3.5 rounded hover:bg-muted-foreground/20 shrink-0'
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDeleteId(page.id);
                }}
                title={t('editor.pages.delete')}
              >
                <X className='h-2.5 w-2.5' />
              </button>
            )}
          </div>
        ))}

        <div className='relative'>
          <button
            ref={addBtnRef}
            className='flex items-center justify-center h-6 w-6 rounded text-muted-foreground hover:bg-muted hover:text-foreground shrink-0'
            onClick={() => setShowPresets(!showPresets)}
            title={t('editor.pages.add')}
          >
            <Plus className='h-3 w-3' />
          </button>

          {showPresets && (
            <div
              ref={presetsRef}
              className='absolute bottom-full left-0 mb-1 w-52 bg-card border rounded shadow-lg z-50 py-1'
              onClick={(e) => e.stopPropagation()}
            >
              <div className='px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground'>
                {t('editor.pages.newPage')}
              </div>

              {FORMAT_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  className='flex items-center justify-between w-full px-3 py-1 text-[11px] hover:bg-muted text-muted-foreground hover:text-foreground transition-colors'
                  onClick={() => handleSelectPreset(preset.width, preset.height)}
                >
                  <span className='truncate'>{preset.label}</span>
                  <span className='text-[10px] text-muted-foreground ml-2 shrink-0'>
                    {preset.width} × {preset.height}
                  </span>
                </button>
              ))}

              <div className='mx-2 my-1 border-t' />

              <div className='px-3 py-0.5'>
                <span className='text-[10px] text-muted-foreground'>{t('editor.pages.custom')}</span>
              </div>
              <div className='flex items-center gap-1 px-3 pb-1.5'>
                <input
                  type='number'
                  value={customWidth}
                  onChange={(e) => setCustomWidth(e.target.value)}
                  placeholder='W'
                  min={1}
                  className='w-full h-5 rounded border border-border bg-background px-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-ring'
                />
                <span className='text-[10px] text-muted-foreground'>×</span>
                <input
                  type='number'
                  value={customHeight}
                  onChange={(e) => setCustomHeight(e.target.value)}
                  placeholder='H'
                  min={1}
                  className='w-full h-5 rounded border border-border bg-background px-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-ring'
                />
                <button
                  onClick={handleCustomCreate}
                  className='h-5 px-2 rounded bg-muted text-[10px] hover:bg-muted/80 transition-colors shrink-0'
                >
                  OK
                </button>
              </div>
            </div>
          )}
        </div>

        {activePage && (
          <span className='text-[11px] text-muted-foreground ml-2 shrink-0'>
            {activePage.width} × {activePage.height}
          </span>
        )}
      </div>

      <div className='flex items-center gap-2'>
        <button
          className='flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed'
          onClick={zoomOut}
          disabled={isMinZoom}
          title={t('editor.zoom.out')}
        >
          <ZoomOut className='h-3 w-3' />
        </button>

        <button
          className='text-[11px] tabular-nums text-muted-foreground hover:text-foreground px-1 rounded hover:bg-muted min-w-[2.5rem] text-center'
          onClick={zoomReset}
          title={t('editor.zoom.reset')}
        >
          {zoomPercent}%
        </button>

        <button
          className='flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed'
          onClick={zoomIn}
          disabled={isMaxZoom}
          title={t('editor.zoom.in')}
        >
          <ZoomIn className='h-3 w-3' />
        </button>

        <button
          className='flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground'
          onClick={zoomReset}
          title={t('editor.zoom.fit')}
        >
          <Maximize2 className='h-3 w-3' />
        </button>
      </div>

      {confirmDeleteId && (
        <div className='absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-[100]'>
          <div
            ref={confirmRef}
            className='bg-card border rounded shadow-lg px-3 py-2 flex items-center gap-2'
          >
            <span className='text-[11px] text-foreground whitespace-nowrap'>
              {t('editor.pages.deleteConfirm')}
            </span>
            <button
              onClick={confirmDeletePage}
              className='h-5 px-2 rounded text-[10px] bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors'
            >
              {t('common.delete')}
            </button>
            <button
              onClick={() => setConfirmDeleteId(null)}
              className='h-5 px-2 rounded text-[10px] bg-muted hover:bg-muted/80 transition-colors'
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}
    </footer>
  );
}
