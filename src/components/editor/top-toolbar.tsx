'use client';

import { Button } from '@/components/ui/button';
import { Undo2, Redo2, Eye } from 'lucide-react';
import { useEditorStore } from '@/stores/editor-store';

export function TopToolbar() {
  const triggerUndo = useEditorStore((s) => s.triggerUndo);
  const triggerRedo = useEditorStore((s) => s.triggerRedo);

  return (
    <header className='flex h-12 items-center justify-between border-b bg-card px-4 shrink-0'>
      <div className='flex items-center gap-3'>
        <span className='text-sm font-semibold tracking-tight'>
          Untitled Project
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
      </div>

      <div className='flex items-center gap-2'>
        <Button variant='outline' size='sm' className='h-8' disabled>
          <Eye className='mr-1.5 h-3.5 w-3.5' />
          Preview
        </Button>
        <Button variant='default' size='sm' className='h-8' disabled>
          Export
        </Button>
      </div>
    </header>
  );
}
