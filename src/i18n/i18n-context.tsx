'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { Translations, Locale } from '@/i18n/locales/types';
import ptBR from '@/i18n/locales/pt-BR';
import en from '@/i18n/locales/en';
import es from '@/i18n/locales/es';

const LOCALE_STORAGE_KEY = 'creative-editor-locale';
const DEFAULT_LOCALE: Locale = 'pt-BR';

const translations: Record<Locale, Translations> = {
  'pt-BR': ptBR,
  'en': en,
  'es': es,
};

function loadLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored === 'pt-BR' || stored === 'en' || stored === 'es') return stored;
  } catch {
    // localStorage not available
  }
  return DEFAULT_LOCALE;
}

interface I18nContextValue {
  locale: Locale;
  t: (path: string) => string;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => loadLocale());

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    } catch {
      // ignore
    }
  }, []);

  const t = useCallback(
    (path: string): string => {
      const keys = path.split('.');
      let value: unknown = translations[locale];

      for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
          value = (value as Record<string, unknown>)[key];
        } else {
          return path;
        }
      }

      return typeof value === 'string' ? value : path;
    },
    [locale],
  );

  return (
    <I18nContext.Provider value={{ locale, t, setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useTranslation must be used within I18nProvider');
  }
  return ctx;
}
