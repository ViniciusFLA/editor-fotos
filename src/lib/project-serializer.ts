import type { AnyElement, ImageElement, PageData } from '@/types';

export interface SerializedProject {
  id: string;
  name: string;
  pages: PageData[];
  activePageId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

async function blobUrlToDataUrl(blobUrl: string): Promise<string> {
  try {
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return blobUrl;
  }
}

async function serializeImageElement(el: ImageElement): Promise<ImageElement> {
  let src = el.src;

  if (src.startsWith('blob:')) {
    src = await blobUrlToDataUrl(src);
  }

  return { ...el, src };
}

export async function serializeProject(
  id: string,
  name: string,
  pages: PageData[],
  activePageId: string,
  activeElements: AnyElement[],
  activeBackground: import('@/types').PageBackground,
  createdAt: string,
): Promise<SerializedProject> {
  const serializedPages: PageData[] = await Promise.all(
    pages.map(async (p) => {
      if (p.id === activePageId) {
        const elements = await Promise.all(
          activeElements.map(async (el) => {
            if (el.type === 'image') {
              return serializeImageElement(el as ImageElement);
            }
            return el;
          }),
        );
        return { ...p, elements, background: activeBackground };
      }

      const elements = await Promise.all(
        p.elements.map(async (el) => {
          if (el.type === 'image') {
            return serializeImageElement(el as ImageElement);
          }
          return el;
        }),
      );
      return { ...p, elements };
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
