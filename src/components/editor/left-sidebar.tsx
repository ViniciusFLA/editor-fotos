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
} from 'lucide-react';
import { useEditorStore } from '@/stores/editor-store';
import { validateImageFile } from '@/lib/image-validation';

const tabs = [
  { id: 'uploads', icon: Upload, label: 'Uploads' },
  { id: 'text', icon: Type, label: 'Text' },
  { id: 'elements', icon: Square, label: 'Elements' },
  { id: 'images', icon: ImageIcon, label: 'Images' },
  { id: 'layers', icon: Layers, label: 'Layers' },
  { id: 'ai', icon: Sparkles, label: 'AI' },
] as const;

export function LeftSidebar() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const setPendingImageSrc = useEditorStore((s) => s.setPendingImageSrc);
  const setUploadError = useEditorStore((s) => s.setUploadError);
  const uploadError = useEditorStore((s) => s.uploadError);

  const handleTabClick = useCallback(
    (tabId: string) => {
      if (tabId === 'uploads') {
        fileInputRef.current?.click();
      }
    },
    [],
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
    <aside className='flex w-12 flex-col border-r bg-card shrink-0'>
      <input
        ref={fileInputRef}
        type='file'
        accept='image/png,image/jpeg,image/webp'
        className='hidden'
        onChange={handleFileChange}
      />

      {tabs.map((tab) => (
        <Button
          key={tab.id}
          variant='ghost'
          size='icon'
          className='h-10 w-12 rounded-none'
          title={uploadError && tab.id === 'uploads' ? uploadError : tab.label}
          onClick={() => handleTabClick(tab.id)}
        >
          <tab.icon
            className={`h-4 w-4 ${uploadError && tab.id === 'uploads' ? 'text-destructive' : 'text-muted-foreground'}`}
          />
        </Button>
      ))}
    </aside>
  );
}
