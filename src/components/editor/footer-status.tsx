'use client';

export function FooterStatus() {
  return (
    <footer className='flex h-7 items-center justify-between border-t bg-card px-4 shrink-0'>
      <div className='flex items-center gap-4'>
        <span className='text-[11px] text-muted-foreground'>
          Page 1
        </span>
        <span className='text-[11px] text-muted-foreground'>
          1080 × 1080
        </span>
      </div>

      <div className='flex items-center gap-3'>
        <span className='text-[11px] text-muted-foreground'>
          Saved
        </span>
        <span className='text-[11px] text-muted-foreground'>
          100%
        </span>
      </div>
    </footer>
  );
}
