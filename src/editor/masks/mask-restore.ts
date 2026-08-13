import type { ImageElement, TextMask } from '@/types';
import { applyMasksToImage } from './inpaint';
import { useEditorStore } from '@/stores/editor-store';

/**
 * ETAPA 34 — restore masks when their text layer is deleted.
 *
 * Deleting an OCR text layer disables its linked mask and recomputes the image
 * from the preserved original, so the raster text reappears (reversible policy:
 * the user never loses the original text by accident). The operation updates
 * the store and triggers a canvas rebuild; undo/redo restore the prior state
 * via the already-pushed history snapshot.
 */
export async function restoreMasksForDeletedTexts(
  deletedTextIds: string[],
): Promise<void> {
  if (deletedTextIds.length === 0) return;

  const store = useEditorStore.getState();
  const pageId = store.activePageId;

  const images = store.elements.filter(
    (el): el is ImageElement => el.type === 'image',
  );

  let changed = false;

  for (const image of images) {
    const masks = image.textMasks;
    if (!masks || masks.length === 0) continue;

    const linked = masks.some(
      (m) => m.enabled && deletedTextIds.includes(m.textLayerId),
    );
    if (!linked) continue;

    const updatedMasks: TextMask[] = masks.map((m) =>
      deletedTextIds.includes(m.textLayerId) ? { ...m, enabled: false } : m,
    );

    const baseSrc = image.originalSrc ?? image.src;
    try {
      const { src } = await applyMasksToImage(baseSrc, updatedMasks);
      useEditorStore.getState().updateElementInPage(pageId, image.id, {
        src,
        textMasks: updatedMasks,
      });
      changed = true;
    } catch (error) {
      console.warn('[TextMask] failed to restore mask on delete', error);
    }
  }

  if (changed) {
    useEditorStore.getState().markUnsaved();
    useEditorStore.getState().triggerRebuildCanvas();
  }
}
