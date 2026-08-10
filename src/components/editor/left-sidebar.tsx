'use client';

import { Button } from '@/components/ui/button';
import {
  Upload,
  Type,
  Square,
  ImageIcon,
  Layers,
  Sparkles,
} from 'lucide-react';

const tabs = [
  { id: 'uploads', icon: Upload, label: 'Uploads' },
  { id: 'text', icon: Type, label: 'Text' },
  { id: 'elements', icon: Square, label: 'Elements' },
  { id: 'images', icon: ImageIcon, label: 'Images' },
  { id: 'layers', icon: Layers, label: 'Layers' },
  { id: 'ai', icon: Sparkles, label: 'AI' },
];

export function LeftSidebar() {
  return (
    <aside className='flex w-12 flex-col border-r bg-card shrink-0'>
      {tabs.map((tab) => (
        <Button
          key={tab.id}
          variant='ghost'
          size='icon'
          className='h-10 w-12 rounded-none'
          title={tab.label}
        >
          <tab.icon className='h-4 w-4 text-muted-foreground' />
        </Button>
      ))}
    </aside>
  );
}
