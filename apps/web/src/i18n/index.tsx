import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { en } from './en';
import type { Dict } from './en';
import { ar } from './ar';
import { fr } from './fr';

export type { Dict };

export type DeepPartial<T> = T extends string
  ? string
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

export type Locale = 'en' | 'ar' | 'fr';

const LOCALES: Record<Locale, { label: string; dir: 'ltr' | 'rtl'; dict: DeepPartial<Dict> }> = {
  en: { label: 'English', dir: 'ltr', dict: en },
  ar: { label: 'العربية', dir: 'rtl', dict: ar },
  fr: { label: 'Français', dir: 'ltr', dict: fr },
};

function deepMerge<T>(base: T, override: DeepPartial<T>): T {
  if (override === undefined || override === null) return base;
  if (typeof base !== 'object' || typeof override !== 'object' || base === null) {
    return override as T;
  }
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(override as Record<string, unknown>)) {
    out[k] = deepMerge((base as Record<string, unknown>)[k], v as DeepPartial<unknown>);
  }
  return out as T;
}

function storedLocale(): Locale {
  const v = localStorage.getItem('autoflow-locale');
  return v === 'ar' || v === 'fr' || v === 'en' ? v : 'en';
}

interface I18nValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: Dict;
  locales: { id: Locale; label: string }[];
}

const I18nContext = createContext<I18nValue>({
  locale: 'en',
  setLocale: () => undefined,
  t: en,
  locales: [],
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(storedLocale);

  useEffect(() => {
    const meta = LOCALES[locale];
    document.documentElement.lang = locale;
    document.documentElement.dir = meta.dir;
    localStorage.setItem('autoflow-locale', locale);
  }, [locale]);

  const value = useMemo<I18nValue>(() => {
    const t = locale === 'en' ? en : deepMerge(en, LOCALES[locale].dict);
    return {
      locale,
      setLocale: setLocaleState,
      t,
      locales: (Object.keys(LOCALES) as Locale[]).map((id) => ({
        id,
        label: LOCALES[id].label,
      })),
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
