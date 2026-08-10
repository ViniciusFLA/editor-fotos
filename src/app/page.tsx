'use client';

import { TopToolbar, LeftSidebar, CanvasArea, RightPanel } from '@/components/editor';
import { FooterStatus } from '@/components/editor/footer-status';
import { LayersPanel } from '@/components/editor/layers-panel';
import { useEditorStore } from '@/stores/editor-store';

export default function EditorPage() {
  const activeSidebarTab = useEditorStore((s) => s.activeSidebarTab);

  return (
    <div className='flex h-full flex-col'>
      <TopToolbar />

      <div className='flex flex-1 min-h-0'>
        <LeftSidebar />
        {activeSidebarTab === 'layers' && <LayersPanel />}
        <CanvasArea />
        <RightPanel />
      </div>

      <FooterStatus />
    </div>
  );
}
