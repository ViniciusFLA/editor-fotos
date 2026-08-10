import { TopToolbar, LeftSidebar, CanvasArea, RightPanel } from '@/components/editor';
import { FooterStatus } from '@/components/editor/footer-status';

export default function EditorPage() {
  return (
    <div className='flex h-full flex-col'>
      <TopToolbar />

      <div className='flex flex-1 min-h-0'>
        <LeftSidebar />
        <CanvasArea />
        <RightPanel />
      </div>

      <FooterStatus />
    </div>
  );
}
