import type { AnyElement, ImageElement, GroupElement, PageData, PageBackground } from '@/types';

export interface SerializedProject {
  id: string;
  name: string;
  pages: PageData[];
  activePageId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

const BLOB_FETCH_TIMEOUT_MS = 10000;

async function blobUrlToDataUrl(blobUrl: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BLOB_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(blobUrl, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Failed to fetch blob: ${response.status}`);
    }
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function serializeElement(el: AnyElement): Promise<AnyElement> {
  if (el.type === 'image') {
    const img = el as ImageElement;
    let src = img.src;
    if (src.startsWith('blob:')) {
      src = await blobUrlToDataUrl(src);
    }
    return { ...img, src };
  }

  if (el.type === 'group') {
    const group = el as GroupElement;
    const serializedChildren = await Promise.all(
      group.childElements.map((child) => serializeElement(child)),
    );
    return { ...group, childElements: serializedChildren };
  }

  return el;
}

async function serializeBackground(bg: PageBackground): Promise<PageBackground> {
  if (bg.type !== 'image' || !bg.src) return bg;
  if (!bg.src.startsWith('blob:')) return bg;

  const src = await blobUrlToDataUrl(bg.src);
  return { ...bg, src };
}

export async function serializeProject(
  id: string,
  name: string,
  pages: PageData[],
  activePageId: string,
  activeElements: AnyElement[],
  activeBackground: PageBackground,
  createdAt: string,
): Promise<SerializedProject> {
  const serializedPages: PageData[] = await Promise.all(
    pages.map(async (p) => {
      const isActive = p.id === activePageId;
      const elements = await Promise.all(
        (isActive ? activeElements : p.elements).map((el) => serializeElement(el)),
      );
      const background = isActive
        ? await serializeBackground(activeBackground)
        : await serializeBackground(p.background);

      return { ...p, elements, background };
    }),
  );

  return {
    id,
    name,
    pages: serializedPages,
    activePageId,
    version: 1,
    createdAt,
    updatedAt: new Date().toISOString(),
  };
}
