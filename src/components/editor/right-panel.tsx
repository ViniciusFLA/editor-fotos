'use client';

export function RightPanel() {
  return (
    <aside className='flex w-64 flex-col border-l bg-card shrink-0'>
      <div className='flex h-10 items-center border-b px-4'>
        <span className='text-xs font-medium text-muted-foreground'>
          Properties
        </span>
      </div>

      <div className='flex flex-1 items-center justify-center'>
        <span className='text-xs text-muted-foreground'>
          Select an element
        </span>
      </div>
    </aside>
  );
}
