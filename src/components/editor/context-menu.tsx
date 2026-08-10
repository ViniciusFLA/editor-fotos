'use client';

import { useEffect, useRef } from 'react';
import { Copy, ClipboardPaste, Trash2, CopyPlus, Ungroup, Group } from 'lucide-react';

export interface ContextMenuItem {
  label: string;
  shortcut?: string;
  icon?: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  onClick: () => void;
  separator?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = () => onClose();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className='fixed z-[100] bg-card border rounded shadow-lg py-1 min-w-[160px]'
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
      role='menu'
    >
      {items.map((item, i) => (
        <div key={i}>
          {item.separator && i > 0 && <div className='mx-2 my-1 border-t' />}
          <button
            className={`flex items-center gap-2 w-full px-3 py-1.5 text-[12px] transition-colors text-left ${
              item.disabled
                ? 'opacity-30 cursor-default'
                : 'hover:bg-muted text-muted-foreground hover:text-foreground'
            }`}
            disabled={item.disabled}
            onClick={(e) => {
              if (!item.disabled) {
                e.stopPropagation();
                item.onClick();
                onClose();
              }
            }}
            role='menuitem'
          >
            {item.icon && <item.icon className='h-3.5 w-3.5' />}
            <span className='flex-1'>{item.label}</span>
            {item.shortcut && (
              <span className='text-[10px] text-muted-foreground ml-4'>
                {item.shortcut}
              </span>
            )}
          </button>
        </div>
      ))}
    </div>
  );
}

export const ICON_MAP = {
  copy: Copy,
  paste: ClipboardPaste,
  delete: Trash2,
  duplicate: CopyPlus,
  group: Group,
  ungroup: Ungroup,
} as const;
