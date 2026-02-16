import { create } from 'zustand';

export type AppLocale = 'ru' | 'uz';

const LOCALE_STORAGE_KEY = 'workspace-booking-locale';
const SUPPORTED_LOCALES: AppLocale[] = ['ru', 'uz'];
const isBrowser = typeof window !== 'undefined';

const isAppLocale = (value: string): value is AppLocale =>
  (SUPPORTED_LOCALES as readonly string[]).includes(value);

const readStoredLocale = (): AppLocale | null => {
  if (!isBrowser) return null;
  try {
    const value = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (!value) return null;
    return isAppLocale(value) ? value : null;
  } catch {
    return null;
  }
};

const detectBrowserLocale = (): AppLocale => {
  if (!isBrowser) return 'ru';
  const language = window.navigator.language.toLowerCase();
  if (language.startsWith('uz')) return 'uz';
  return 'ru';
};

const detectInitialLocale = (): AppLocale => readStoredLocale() ?? detectBrowserLocale();

const applyLocaleToDocument = (locale: AppLocale) => {
  if (!isBrowser) return;
  document.documentElement.lang = locale;
};

const persistLocale = (locale: AppLocale) => {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Ignore localStorage errors and keep in-memory state.
  }
};

const initialLocale = detectInitialLocale();
applyLocaleToDocument(initialLocale);

interface LocaleState {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
}

export const useLocaleStore = create<LocaleState>((set) => ({
  locale: initialLocale,
  setLocale: (locale) => {
    persistLocale(locale);
    applyLocaleToDocument(locale);
    set({ locale });
  },
}));
