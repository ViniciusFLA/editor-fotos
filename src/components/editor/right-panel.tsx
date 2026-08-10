'use client';

import { useMemo, useCallback } from 'react';
import { useEditorStore } from '@/stores/editor-store';
import type { AnyElement, TextElement } from '@/types';

const FONT_FAMILIES = [
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Georgia',
  'Verdana',
  'Courier New',
  'Impact',
];

function round(n: number, decimals = 0): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className='flex items-center gap-2 px-3 py-1.5'>
      <span className='w-6 text-[11px] text-muted-foreground shrink-0'>
        {label}
      </span>
      {children}
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <input
      type='number'
      value={round(value, 2)}
      onChange={(e) => {
        const v = parseFloat(e.target.value);
        if (!isNaN(v)) onChange(v);
      }}
      min={min}
      max={max}
      step={step}
      className='flex-1 h-6 rounded border border-border bg-background px-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-ring'
    />
  );
}

export function RightPanel() {
  const selectedElementIds = useEditorStore((s) => s.selectedElementIds);
  const elements = useEditorStore((s) => s.elements);
  const updateElement = useEditorStore((s) => s.updateElement);

  const element = useMemo<AnyElement | null>(() => {
    if (selectedElementIds.length !== 1) return null;
    return elements.find((el) => el.id === selectedElementIds[0]) ?? null;
  }, [selectedElementIds, elements]);

  const handleChange = useCallback(
    (updates: Partial<AnyElement>) => {
      if (!element) return;
      updateElement(element.id, updates);
    },
    [element, updateElement],
  );

  if (!element) {
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

  const isText = element.type === 'text';
  const textEl = isText ? (element as TextElement) : null;

  return (
    <aside className='flex w-64 flex-col border-l bg-card shrink-0 overflow-y-auto'>
      <div className='flex h-10 items-center border-b px-4 shrink-0'>
        <span className='text-xs font-medium text-muted-foreground'>
          Properties
        </span>
      </div>

      <div className='flex flex-col gap-px py-1'>
        <div className='px-3 py-1'>
          <span className='text-[10px] font-semibold uppercase tracking-wider text-muted-foreground'>
            Position
          </span>
        </div>
        <FieldRow label='X'>
          <NumberInput
            value={element.x}
            onChange={(v) => handleChange({ x: v })}
          />
        </FieldRow>
        <FieldRow label='Y'>
          <NumberInput
            value={element.y}
            onChange={(v) => handleChange({ y: v })}
          />
        </FieldRow>
      </div>

      <div className='flex flex-col gap-px py-1'>
        <div className='px-3 py-1'>
          <span className='text-[10px] font-semibold uppercase tracking-wider text-muted-foreground'>
            Size
          </span>
        </div>
        <FieldRow label='W'>
          <NumberInput
            value={element.width}
            onChange={(v) => handleChange({ width: Math.max(1, v) })}
            min={1}
          />
        </FieldRow>
        <FieldRow label='H'>
          <NumberInput
            value={element.height}
            onChange={(v) => handleChange({ height: Math.max(1, v) })}
            min={1}
          />
        </FieldRow>
      </div>

      <div className='flex flex-col gap-px py-1'>
        <div className='px-3 py-1'>
          <span className='text-[10px] font-semibold uppercase tracking-wider text-muted-foreground'>
            Transform
          </span>
        </div>
        <FieldRow label='R'>
          <NumberInput
            value={element.rotation}
            onChange={(v) => handleChange({ rotation: v })}
            step={1}
          />
        </FieldRow>
        <FieldRow label='O'>
          <div className='flex flex-1 items-center gap-2'>
            <input
              type='range'
              min={0}
              max={100}
              value={Math.round(element.opacity * 100)}
              onChange={(e) => handleChange({ opacity: parseInt(e.target.value) / 100 })}
              className='flex-1 h-1'
            />
            <span className='w-7 text-right text-[11px] text-muted-foreground'>
              {Math.round(element.opacity * 100)}%
            </span>
          </div>
        </FieldRow>
      </div>

      {isText && textEl && (
        <>
          <div className='flex flex-col gap-px py-1'>
            <div className='px-3 py-1'>
              <span className='text-[10px] font-semibold uppercase tracking-wider text-muted-foreground'>
                Text
              </span>
            </div>
            <FieldRow label='Sz'>
              <NumberInput
                value={textEl.fontSize}
                onChange={(v) => handleChange({ fontSize: Math.max(1, v) })}
                min={1}
              />
            </FieldRow>
            <FieldRow label='Fnt'>
              <select
                value={textEl.fontFamily}
                onChange={(e) => handleChange({ fontFamily: e.target.value })}
                className='flex-1 h-6 rounded border border-border bg-background px-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-ring'
              >
                {FONT_FAMILIES.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </FieldRow>
            <FieldRow label='W'>
              <select
                value={textEl.fontWeight}
                onChange={(e) => handleChange({ fontWeight: e.target.value })}
                className='flex-1 h-6 rounded border border-border bg-background px-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-ring'
              >
                <option value='normal'>Normal</option>
                <option value='bold'>Bold</option>
              </select>
            </FieldRow>
            <FieldRow label='Al'>
              <div className='flex flex-1 gap-px'>
                {(['left', 'center', 'right'] as const).map((align) => (
                  <button
                    key={align}
                    onClick={() => handleChange({ textAlign: align })}
                    className={`flex-1 h-6 rounded border text-[10px] transition-colors ${
                      textEl.textAlign === align
                        ? 'border-ring bg-muted text-foreground'
                        : 'border-border bg-background text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {align.charAt(0).toUpperCase() + align.slice(1)}
                  </button>
                ))}
              </div>
            </FieldRow>
            <FieldRow label='C'>
              <div className='flex items-center gap-2 flex-1'>
                <input
                  type='color'
                  value={textEl.fill}
                  onChange={(e) => handleChange({ fill: e.target.value })}
                  className='h-5 w-6 rounded border border-border p-0 cursor-pointer'
                />
                <span className='text-[11px] text-muted-foreground'>
                  {textEl.fill}
                </span>
              </div>
            </FieldRow>
          </div>
        </>
      )}
    </aside>
  );
}
