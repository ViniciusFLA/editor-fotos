export interface FontEntry {
  family: string;
  category: 'system' | 'sans-serif' | 'serif' | 'display' | 'handwriting' | 'monospace';
}

export const SYSTEM_FONTS: FontEntry[] = [
  { family: 'Arial', category: 'system' },
  { family: 'Helvetica', category: 'system' },
  { family: 'Times New Roman', category: 'system' },
  { family: 'Georgia', category: 'system' },
  { family: 'Verdana', category: 'system' },
  { family: 'Courier New', category: 'system' },
  { family: 'Impact', category: 'system' },
];

export const GOOGLE_FONTS: FontEntry[] = [
  { family: 'Roboto', category: 'sans-serif' },
  { family: 'Open Sans', category: 'sans-serif' },
  { family: 'Montserrat', category: 'sans-serif' },
  { family: 'Lato', category: 'sans-serif' },
  { family: 'Poppins', category: 'sans-serif' },
  { family: 'Oswald', category: 'sans-serif' },
  { family: 'Raleway', category: 'sans-serif' },
  { family: 'Inter', category: 'sans-serif' },
  { family: 'DM Sans', category: 'sans-serif' },
  { family: 'Nunito', category: 'sans-serif' },
  { family: 'Ubuntu', category: 'sans-serif' },
  { family: 'Playfair Display', category: 'serif' },
  { family: 'Merriweather', category: 'serif' },
  { family: 'PT Serif', category: 'serif' },
  { family: 'Lora', category: 'serif' },
  { family: 'Bebas Neue', category: 'display' },
  { family: 'Anton', category: 'display' },
  { family: 'Righteous', category: 'display' },
  { family: 'Pacifico', category: 'handwriting' },
  { family: 'Caveat', category: 'handwriting' },
  { family: 'Source Code Pro', category: 'monospace' },
  { family: 'Fira Code', category: 'monospace' },
];

export const ALL_FONTS: FontEntry[] = [...SYSTEM_FONTS, ...GOOGLE_FONTS];

export function isGoogleFont(family: string): boolean {
  return GOOGLE_FONTS.some((f) => f.family === family);
}

const loadedFonts = new Set<string>();

const linkElements = new Map<string, HTMLLinkElement>();

function createGoogleFontLink(family: string): HTMLLinkElement {
  const existing = linkElements.get(family);
  if (existing) return existing;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;700&display=swap`;
  document.head.appendChild(link);

  linkElements.set(family, link);
  return link;
}

export async function loadGoogleFont(family: string): Promise<boolean> {
  if (!isGoogleFont(family)) return true;
  if (loadedFonts.has(family)) return true;

  createGoogleFontLink(family);

  try {
    await document.fonts.load(`12px "${family}"`);
    loadedFonts.add(family);
    return true;
  } catch {
    return false;
  }
}

export function getFontFallback(family: string): string {
  if (!isGoogleFont(family)) return family;

  return `"${family}", Arial, sans-serif`;
}

export function isFontLoaded(family: string): boolean {
  if (!isGoogleFont(family)) return true;
  return loadedFonts.has(family);
}
