'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Undo2, Redo2, Eye, Ungroup, Group, Check, Loader2, AlertCircle, Download, FileImage } from 'lucide-react';
import { useEditorStore } from '@/stores/editor-store';

export function TopToolbar() {
  const triggerUndo = useEditorStore((s) => s.triggerUndo);
  const triggerRedo = useEditorStore((s) => s.triggerRedo);
  const triggerGroup = useEditorStore((s) => s.triggerGroup);
  const triggerUngroup = useEditorStore((s) => s.triggerUngroup);
  const projectName = useEditorStore((s) => s.projectName);
  const setProjectName = useEditorStore((s) => s.setProjectName);
  const saveStatus = useEditorStore((s) => s.saveStatus);
  const triggerExport = useEditorStore((s) => s.triggerExport);

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(projectName);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [showExport, setShowExport] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const exportBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (showExport) {
      const handleClickOutside = (e: MouseEvent) => {
        if (
          exportRef.current &&
          !exportRef.current.contains(e.target as Node) &&
          exportBtnRef.current &&
          !exportBtnRef.current.contains(e.target as Node)
        ) {
          setShowExport(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showExport]);

  useEffect(() => {
    if (editingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [editingName]);

  const commitName = useCallback(() => {
    const trimmed = nameValue.trim();
    if (trimmed) {
      setProjectName(trimmed);
    }
    setEditingName(false);
  }, [nameValue, setProjectName]);

  return (
    <header className='flex h-12 items-center justify-between border-b bg-card px-4 shrink-0'>
      <div className='flex items-center gap-3'>
        {editingName ? (
          <input
            ref={nameInputRef}
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitName();
              if (e.key === 'Escape') {
                setNameValue(projectName);
                setEditingName(false);
              }
            }}
            className='h-7 rounded border border-ring bg-background px-2 text-sm font-semibold focus:outline-none'
          />
        ) : (
          <span
            className='text-sm font-semibold tracking-tight cursor-pointer hover:text-foreground/70'
            onDoubleClick={() => {
              setNameValue(projectName);
              setEditingName(true);
            }}
            title='Double-click to rename'
          >
            {projectName}
          </span>
        )}

        <span className='text-[11px] text-muted-foreground'>
          {saveStatus === 'saved' && (
            <Check className='h-3 w-3 text-green-500' />
          )}
          {saveStatus === 'saving' && (
            <Loader2 className='h-3 w-3 animate-spin text-muted-foreground' />
          )}
          {saveStatus === 'unsaved' && (
            <span className='text-amber-500'>●</span>
          )}
          {saveStatus === 'error' && (
            <AlertCircle className='h-3 w-3 text-destructive' />
          )}
        </span>
      </div>

      <div className='flex items-center gap-1'>
        <Button
          variant='ghost'
          size='icon'
          className='h-8 w-8'
          onClick={() => triggerUndo()}
          title='Undo (Ctrl+Z)'
        >
          <Undo2 className='h-4 w-4' />
        </Button>
        <Button
          variant='ghost'
          size='icon'
          className='h-8 w-8'
          onClick={() => triggerRedo()}
          title='Redo (Ctrl+Shift+Z)'
        >
          <Redo2 className='h-4 w-4' />
        </Button>
        <div className='mx-1 h-5 w-px bg-border' />
        <Button
          variant='ghost'
          size='icon'
          className='h-8 w-8'
          onClick={() => triggerGroup()}
          title='Group (Ctrl+G)'
        >
          <Group className='h-4 w-4' />
        </Button>
        <Button
          variant='ghost'
          size='icon'
          className='h-8 w-8'
          onClick={() => triggerUngroup()}
          title='Ungroup (Ctrl+Shift+G)'
        >
          <Ungroup className='h-4 w-4' />
        </Button>
      </div>

      <div className='flex items-center gap-2 relative'>
        <Button variant='outline' size='sm' className='h-8' disabled>
          <Eye className='mr-1.5 h-3.5 w-3.5' />
          Preview
        </Button>
        <Button
          ref={exportBtnRef}
          variant='default'
          size='sm'
          className='h-8'
          onClick={() => setShowExport(!showExport)}
        >
          <Download className='mr-1.5 h-3.5 w-3.5' />
          Export
        </Button>

        {showExport && (
          <div
            ref={exportRef}
            className='absolute top-full right-0 mt-1 w-44 bg-card border rounded shadow-lg z-50 py-1'
          >
            <div className='px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground'>
              Format
            </div>
            {(['png', 'jpeg', 'webp'] as const).map((fmt) => (
              <button
                key={fmt}
                className='flex items-center gap-2 w-full px-3 py-1 text-[11px] hover:bg-muted text-muted-foreground hover:text-foreground transition-colors'
                onClick={() => {
                  triggerExport(fmt, 1);
                  setShowExport(false);
                }}
              >
                <FileImage className='h-3 w-3' />
                <span>{fmt === 'jpeg' ? 'JPG' : fmt.toUpperCase()}</span>
                <span className='ml-auto text-[10px] text-muted-foreground'>1x</span>
              </button>
            ))}

            <div className='mx-2 my-1 border-t' />
            <div className='px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground'>
              Scale
            </div>
            {([2, 3] as const).map((s) => (
              <button
                key={s}
                className='flex items-center gap-2 w-full px-3 py-1 text-[11px] hover:bg-muted text-muted-foreground hover:text-foreground transition-colors'
                onClick={() => {
                  triggerExport('png', s);
                  setShowExport(false);
                }}
              >
                <FileImage className='h-3 w-3' />
                <span>PNG @{s}x</span>
                <span className='ml-auto text-[10px] text-muted-foreground'>
                  {1080 * s}×{1080 * s}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
