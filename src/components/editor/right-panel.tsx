'use client';

import { useMemo, useCallback, useState } from 'react';
import { Crop, Check, X, Loader2 } from 'lucide-react';
import { useEditorStore } from '@/stores/editor-store';
import { pushHistoryDebounced } from '@/editor/history/history-manager';
import type { AnyElement, TextElement, ShapeElement, ImageElement, PageBackground } from '@/types';
import { ALL_FONTS, loadGoogleFont, isGoogleFont, isFontLoaded } from '@/lib/font-loader';

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
  const cropModeElementId = useEditorStore((s) => s.cropModeElementId);
  const cropModeSnapshot = useEditorStore((s) => s.cropModeSnapshot);
  const setCropMode = useEditorStore((s) => s.setCropMode);
  const triggerFontReload = useEditorStore((s) => s.triggerFontReload);
  const pageBackground = useEditorStore((s) => s.pageBackground);
  const setPageBackground = useEditorStore((s) => s.setPageBackground);

  const [loadingFont, setLoadingFont] = useState<string | null>(null);

  const element = useMemo<AnyElement | null>(() => {
    if (selectedElementIds.length !== 1) return null;
    return elements.find((el) => el.id === selectedElementIds[0]) ?? null;
  }, [selectedElementIds, elements]);

  const handleChange = useCallback(
    (updates: Partial<AnyElement>) => {
      const store = useEditorStore.getState();
      const currentId = store.selectedElementIds[0];
      if (!currentId) return;
      pushHistoryDebounced(store.activePageId, store.elements, store.pageBackground);
      updateElement(currentId, updates);
    },
    [updateElement],
  );

  const handleFontChange = useCallback(
    async (family: string) => {
      if (!element) return;

      if (isGoogleFont(family) && !isFontLoaded(family)) {
        setLoadingFont(family);
        try {
          const loaded = await loadGoogleFont(family);
          if (loaded) {
            triggerFontReload();
          }
        } catch {
          // font load failed — keep current font, fontFamily not changed
          setLoadingFont(null);
          return;
        }
        setLoadingFont(null);
      }

      const store = useEditorStore.getState();
      pushHistoryDebounced(store.activePageId, store.elements, store.pageBackground);
      updateElement(element.id, { fontFamily: family });
    },
    [element, updateElement, triggerFontReload],
  );

  const handleBackgroundChange = useCallback(
    (updates: Partial<PageBackground>) => {
      const store = useEditorStore.getState();
      pushHistoryDebounced(store.activePageId, store.elements, store.pageBackground);
      setPageBackground({ ...pageBackground, ...updates });
    },
    [pageBackground, setPageBackground],
  );

  if (!element) {
    return (
      <aside className='flex w-64 flex-col border-l bg-card shrink-0 overflow-y-auto'>
        <div className='flex h-10 items-center border-b px-4 shrink-0'>
          <span className='text-xs font-medium text-muted-foreground'>
            Page
          </span>
        </div>

        <div className='flex flex-col gap-px py-1'>
          <div className='px-3 py-1'>
            <span className='text-[10px] font-semibold uppercase tracking-wider text-muted-foreground'>
              Background
            </span>
          </div>
          <FieldRow label='Type'>
            <select
              value={pageBackground.type}
              onChange={(e) =>
                handleBackgroundChange({ type: e.target.value as PageBackground['type'] })
              }
              className='flex-1 h-6 rounded border border-border bg-background px-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-ring'
            >
              <option value='none'>None</option>
              <option value='color'>Solid Color</option>
              <option value='image'>Image</option>
              <option value='linear-gradient'>Linear Gradient</option>
              <option value='radial-gradient'>Radial Gradient</option>
            </select>
          </FieldRow>

          {pageBackground.type === 'color' && (
            <FieldRow label='C'>
              <div className='flex items-center gap-2 flex-1'>
                <input
                  type='color'
                  value={pageBackground.color}
                  onChange={(e) => handleBackgroundChange({ color: e.target.value })}
                  className='h-5 w-6 rounded border border-border p-0 cursor-pointer'
                />
                <span className='text-[11px] text-muted-foreground'>
                  {pageBackground.color}
                </span>
              </div>
            </FieldRow>
          )}

          {pageBackground.type === 'image' && (
            <FieldRow label='URL'>
              <input
                type='text'
                value={pageBackground.src}
                onChange={(e) => handleBackgroundChange({ src: e.target.value })}
                placeholder='https://...'
                className='flex-1 h-6 rounded border border-border bg-background px-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-ring'
              />
            </FieldRow>
          )}

          {(pageBackground.type === 'linear-gradient' || pageBackground.type === 'radial-gradient') && (
            <>
              <FieldRow label='St'>
                <div className='flex items-center gap-2 flex-1'>
                  <input
                    type='color'
                    value={pageBackground.gradientStops[0]?.color ?? '#ffffff'}
                    onChange={(e) => {
                      const stops = [...pageBackground.gradientStops];
                      if (stops[0]) stops[0] = { ...stops[0], color: e.target.value };
                      handleBackgroundChange({ gradientStops: stops });
                    }}
                    className='h-5 w-6 rounded border border-border p-0 cursor-pointer'
                  />
                  <span className='text-[10px] text-muted-foreground'>Start</span>
                </div>
              </FieldRow>
              <FieldRow label='En'>
                <div className='flex items-center gap-2 flex-1'>
                  <input
                    type='color'
                    value={pageBackground.gradientStops[1]?.color ?? '#cccccc'}
                    onChange={(e) => {
                      const stops = [...pageBackground.gradientStops];
                      if (stops[1]) stops[1] = { ...stops[1], color: e.target.value };
                      handleBackgroundChange({ gradientStops: stops });
                    }}
                    className='h-5 w-6 rounded border border-border p-0 cursor-pointer'
                  />
                  <span className='text-[10px] text-muted-foreground'>End</span>
                </div>
              </FieldRow>
            </>
          )}

          {pageBackground.type === 'linear-gradient' && (
            <FieldRow label='Dir'>
              <div className='flex flex-1 items-center gap-2'>
                <input
                  type='range'
                  min={0}
                  max={360}
                  value={pageBackground.direction}
                  onChange={(e) => handleBackgroundChange({ direction: parseInt(e.target.value) })}
                  className='flex-1 h-1'
                />
                <span className='w-7 text-right text-[11px] text-muted-foreground'>
                  {pageBackground.direction}°
                </span>
              </div>
            </FieldRow>
          )}
        </div>
      </aside>
    );
  }

  const isText = element.type === 'text';
  const isShape = element.type === 'shape';
  const isImage = element.type === 'image';
  const isCropMode = cropModeElementId === element.id;
  const textEl = isText ? (element as TextElement) : null;
  const shapeEl = isShape ? (element as ShapeElement) : null;
  const imageEl = isImage ? (element as ImageElement) : null;

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
              <div className='flex flex-1 items-center gap-1'>
                <select
                  value={textEl.fontFamily}
                  onChange={(e) => handleFontChange(e.target.value)}
                  disabled={loadingFont !== null}
                  className='flex-1 h-6 rounded border border-border bg-background px-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50'
                >
                  <optgroup label='System Fonts'>
                    {ALL_FONTS.filter((f) => f.category === 'system').map((f) => (
                      <option key={f.family} value={f.family} style={{ fontFamily: f.family }}>
                        {f.family}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label='Google Fonts'>
                    {ALL_FONTS.filter((f) => f.category !== 'system').map((f) => (
                      <option
                        key={f.family}
                        value={f.family}
                        style={{ fontFamily: f.family }}
                      >
                        {f.family}
                        {isGoogleFont(f.family) && !isFontLoaded(f.family) ? ' ...' : ''}
                      </option>
                    ))}
                  </optgroup>
                </select>
                {loadingFont === textEl.fontFamily && (
                  <Loader2 className='h-3 w-3 animate-spin text-muted-foreground shrink-0' />
                )}
              </div>
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

      {isShape && shapeEl && (
        <div className='flex flex-col gap-px py-1'>
          <div className='px-3 py-1'>
            <span className='text-[10px] font-semibold uppercase tracking-wider text-muted-foreground'>
              Shape
            </span>
          </div>
          <FieldRow label='Fill'>
            <div className='flex items-center gap-2 flex-1'>
              <input
                type='color'
                value={shapeEl.fill}
                onChange={(e) => handleChange({ fill: e.target.value })}
                className='h-5 w-6 rounded border border-border p-0 cursor-pointer'
              />
              <span className='text-[11px] text-muted-foreground'>
                {shapeEl.fill}
              </span>
            </div>
          </FieldRow>
          <FieldRow label='Stk'>
            <div className='flex items-center gap-2 flex-1'>
              <input
                type='color'
                value={shapeEl.stroke}
                onChange={(e) => handleChange({ stroke: e.target.value })}
                className='h-5 w-6 rounded border border-border p-0 cursor-pointer'
              />
              <span className='text-[11px] text-muted-foreground'>
                {shapeEl.stroke}
              </span>
            </div>
          </FieldRow>
          <FieldRow label='Sw'>
            <NumberInput
              value={shapeEl.strokeWidth}
              onChange={(v) => handleChange({ strokeWidth: Math.max(0, v) })}
              min={0}
              step={0.5}
            />
          </FieldRow>
        </div>
      )}

      {isImage && imageEl && (
        <div className='flex flex-col gap-px py-1'>
          <div className='flex items-center justify-between px-3 py-1'>
            <span className='text-[10px] font-semibold uppercase tracking-wider text-muted-foreground'>
              Crop
            </span>
            {isCropMode ? (
              <div className='flex items-center gap-0.5'>
                <button
                  onClick={() => {
                    const s = useEditorStore.getState();
                    pushHistoryDebounced(s.activePageId, s.elements, s.pageBackground);
                    setCropMode(null);
                  }}
                  className='flex items-center gap-1 h-5 px-1.5 rounded text-[10px] bg-green-600 text-white hover:bg-green-700 transition-colors'
                  title='Apply Crop'
                >
                  <Check className='h-3 w-3' />
                </button>
                <button
                  onClick={() => {
                    if (!element) return;
                    const store = useEditorStore.getState();
                    const original = store.elements.find((e) => e.id === element.id);
                    if (original && cropModeSnapshot) {
                      updateElement(element.id, {
                        cropX: cropModeSnapshot.cropX,
                        cropY: cropModeSnapshot.cropY,
                        width: cropModeSnapshot.width,
                        height: cropModeSnapshot.height,
                      });
                    }
                    setCropMode(null);
                  }}
                  className='flex items-center gap-1 h-5 px-1.5 rounded text-[10px] bg-muted hover:bg-muted/80 transition-colors'
                  title='Cancel Crop'
                >
                  <X className='h-3 w-3' />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  const s = useEditorStore.getState();
                  pushHistoryDebounced(s.activePageId, s.elements, s.pageBackground);
                  setCropMode(element.id, {
                    cropX: imageEl.cropX,
                    cropY: imageEl.cropY,
                    width: imageEl.width,
                    height: imageEl.height,
                  });
                }}
                className='flex items-center gap-1 h-5 px-1.5 rounded text-[10px] bg-muted hover:bg-muted/80 transition-colors text-muted-foreground'
                title='Enter Crop Mode'
              >
                <Crop className='h-3 w-3' />
                Crop
              </button>
            )}
          </div>
          <FieldRow label='cX'>
            <NumberInput
              value={imageEl.cropX}
              onChange={(v) => handleChange({ cropX: Math.max(0, v) })}
              min={0}
            />
          </FieldRow>
          <FieldRow label='cY'>
            <NumberInput
              value={imageEl.cropY}
              onChange={(v) => handleChange({ cropY: Math.max(0, v) })}
              min={0}
            />
          </FieldRow>
        </div>
      )}

      {isImage && imageEl && (
        <div className='flex flex-col gap-px py-1'>
          <div className='px-3 py-1'>
            <span className='text-[10px] font-semibold uppercase tracking-wider text-muted-foreground'>
              Filters
            </span>
          </div>
          <FieldRow label='Br'>
            <div className='flex flex-1 items-center gap-2'>
              <input
                type='range'
                min={-100}
                max={100}
                value={Math.round(imageEl.filters.brightness * 100)}
                onChange={(e) =>
                  handleChange({
                    filters: {
                      ...imageEl.filters,
                      brightness: parseInt(e.target.value) / 100,
                    },
                  })
                }
                className='flex-1 h-1'
              />
              <span className='w-7 text-right text-[11px] text-muted-foreground'>
                {Math.round(imageEl.filters.brightness * 100)}
              </span>
            </div>
          </FieldRow>
          <FieldRow label='Ct'>
            <div className='flex flex-1 items-center gap-2'>
              <input
                type='range'
                min={-100}
                max={100}
                value={Math.round(imageEl.filters.contrast * 100)}
                onChange={(e) =>
                  handleChange({
                    filters: {
                      ...imageEl.filters,
                      contrast: parseInt(e.target.value) / 100,
                    },
                  })
                }
                className='flex-1 h-1'
              />
              <span className='w-7 text-right text-[11px] text-muted-foreground'>
                {Math.round(imageEl.filters.contrast * 100)}
              </span>
            </div>
          </FieldRow>
          <FieldRow label='St'>
            <div className='flex flex-1 items-center gap-2'>
              <input
                type='range'
                min={-100}
                max={100}
                value={Math.round(imageEl.filters.saturation * 100)}
                onChange={(e) =>
                  handleChange({
                    filters: {
                      ...imageEl.filters,
                      saturation: parseInt(e.target.value) / 100,
                    },
                  })
                }
                className='flex-1 h-1'
              />
              <span className='w-7 text-right text-[11px] text-muted-foreground'>
                {Math.round(imageEl.filters.saturation * 100)}
              </span>
            </div>
          </FieldRow>
          <FieldRow label='Bl'>
            <div className='flex flex-1 items-center gap-2'>
              <input
                type='range'
                min={0}
                max={100}
                value={Math.round(imageEl.filters.blur * 100)}
                onChange={(e) =>
                  handleChange({
                    filters: {
                      ...imageEl.filters,
                      blur: parseInt(e.target.value) / 100,
                    },
                  })
                }
                className='flex-1 h-1'
              />
              <span className='w-7 text-right text-[11px] text-muted-foreground'>
                {Math.round(imageEl.filters.blur * 100)}
              </span>
            </div>
          </FieldRow>
          <FieldRow label='Gy'>
            <button
              onClick={() =>
                handleChange({
                  filters: {
                    ...imageEl.filters,
                    grayscale: !imageEl.filters.grayscale,
                  },
                })
              }
              className={`h-5 px-2 rounded text-[10px] transition-colors ${
                imageEl.filters.grayscale
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {imageEl.filters.grayscale ? 'On' : 'Off'}
            </button>
          </FieldRow>
        </div>
      )}
    </aside>
  );
}
