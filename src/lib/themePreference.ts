export type ThemePreference = 'light' | 'dark' | 'system';

const THEME_STORAGE_KEY = 'theme';
const OAUTH_THEME_STORAGE_KEY = 'tezbron-oauth-theme';

const isBrowser = typeof window !== 'undefined';

const isThemePreference = (value: unknown): value is ThemePreference =>
  value === 'light' || value === 'dark' || value === 'system';

export const readThemePreference = (): ThemePreference | null => {
  if (!isBrowser) return null;

  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(value) ? value : null;
  } catch {
    return null;
  }
};

const writeThemePreference = (value: ThemePreference) => {
  if (!isBrowser) return;

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, value);
  } catch {
    // Ignore storage errors and keep runtime behavior.
  }
};

const applyThemeClass = (value: ThemePreference) => {
  if (!isBrowser) return;

  const root = document.documentElement;
  root.classList.remove('light', 'dark');

  if (value === 'system') {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.add(isDark ? 'dark' : 'light');
    return;
  }

  root.classList.add(value);
};

export const rememberThemePreferenceForOAuth = () => {
  if (!isBrowser) return;

  const value = readThemePreference() ?? 'light';

  try {
    window.sessionStorage.setItem(OAUTH_THEME_STORAGE_KEY, value);
  } catch {
    // Ignore storage errors and keep runtime behavior.
  }
};

export const restoreThemePreferenceAfterOAuth = () => {
  if (!isBrowser) return;

  let value = readThemePreference();

  if (!value) {
    try {
      const sessionValue = window.sessionStorage.getItem(OAUTH_THEME_STORAGE_KEY);
      value = isThemePreference(sessionValue) ? sessionValue : null;
    } catch {
      value = null;
    }
  }

  const resolvedTheme = value ?? 'light';
  writeThemePreference(resolvedTheme);
  applyThemeClass(resolvedTheme);

  try {
    window.sessionStorage.removeItem(OAUTH_THEME_STORAGE_KEY);
  } catch {
    // Ignore storage errors and keep runtime behavior.
  }
};
