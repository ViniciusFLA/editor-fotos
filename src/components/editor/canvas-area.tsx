'use client';

import { useCanvas } from '@/hooks/use-canvas';

const LOGICAL_WIDTH = 1080;
const LOGICAL_HEIGHT = 1080;

export function CanvasArea() {
  const { canvasElRef, containerRef, scale, canvasReady } = useCanvas({
    logicalWidth: LOGICAL_WIDTH,
    logicalHeight: LOGICAL_HEIGHT,
  });

  return (
    <div className='flex flex-1 bg-[#e5e5e5] overflow-hidden'>
      <div ref={containerRef} className='relative flex-1 overflow-hidden'>
        <div
          className='absolute'
          style={{
            top: '50%',
            left: '50%',
            transform: `translate(-50%, -50%) scale(${scale})`,
            visibility: canvasReady ? 'visible' : 'hidden',
          }}
        >
          <canvas ref={canvasElRef} />
        </div>
      </div>
    </div>
  );
}
