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
import type { ShapeType } from '@/types';

const tabs = [
  { id: 'uploads', icon: Upload, label: 'Uploads' },
  { id: 'text', icon: Type, label: 'Text' },
  { id: 'elements', icon: Square, label: 'Elements' },
  { id: 'images', icon: ImageIcon, label: 'Images' },
  { id: 'layers', icon: Layers, label: 'Layers' },
  { id: 'ai', icon: Sparkles, label: 'AI' },
] as const;

const shapeOptions: { icon: React.ComponentType<{ className?: string }>; type: ShapeType; label: string }[] = [
  { icon: RectangleHorizontal, type: 'rectangle', label: 'Rectangle' },
  { icon: Circle, type: 'circle', label: 'Circle' },
  { icon: Minus, type: 'line', label: 'Line' },
];

export function LeftSidebar() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const setPendingImageSrc = useEditorStore((s) => s.setPendingImageSrc);
  const setUploadError = useEditorStore((s) => s.setUploadError);
  const uploadError = useEditorStore((s) => s.uploadError);
  const triggerTextAdd = useEditorStore((s) => s.triggerTextAdd);
  const triggerShapeAdd = useEditorStore((s) => s.triggerShapeAdd);
  const activeSidebarTab = useEditorStore((s) => s.activeSidebarTab);
  const setActiveSidebarTab = useEditorStore((s) => s.setActiveSidebarTab);

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
      setActiveSidebarTab(null);
    },
    [
      triggerTextAdd,
      triggerShapeAdd,
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
              uploadError && tab.id === 'uploads' ? uploadError : tab.label
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
              title={opt.label}
            >
              <opt.icon className='h-3.5 w-3.5' />
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}
