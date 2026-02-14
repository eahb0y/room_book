export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

const AUTH_SESSION_STORAGE_KEY = 'workspace-booking-auth-session';

const isBrowser = typeof window !== 'undefined';

const isAuthSession = (value: unknown): value is AuthSession => {
  if (!value || typeof value !== 'object') return false;
  const session = value as Record<string, unknown>;

  return (
    typeof session.accessToken === 'string' &&
    typeof session.refreshToken === 'string' &&
    typeof session.expiresAt === 'number'
  );
};

const removeStoredSession = () => {
  if (!isBrowser) return;

  try {
    window.sessionStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage errors (private mode/quota) and keep in-memory fallback.
  }
};

const persistSession = (session: AuthSession | null) => {
  if (!isBrowser) return;

  if (!session) {
    removeStoredSession();
    return;
  }

  try {
    window.sessionStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Ignore storage errors (private mode/quota) and keep in-memory fallback.
  }
};

const readStoredSession = (): AuthSession | null => {
  if (!isBrowser) return null;

  try {
    const raw = window.sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as unknown;
    if (!isAuthSession(parsed) || parsed.expiresAt <= Date.now()) {
      removeStoredSession();
      return null;
    }

    return parsed;
  } catch {
    removeStoredSession();
    return null;
  }
};

let currentSession: AuthSession | null = readStoredSession();

export const setAuthSession = (session: AuthSession | null) => {
  if (!session || session.expiresAt <= Date.now()) {
    currentSession = null;
    removeStoredSession();
    return;
  }

  currentSession = session;
  persistSession(session);
};

export const getAuthSession = () => {
  if (!currentSession) return null;

  if (currentSession.expiresAt <= Date.now()) {
    clearAuthSession();
    return null;
  }

  return currentSession;
};

export const clearAuthSession = () => {
  currentSession = null;
  removeStoredSession();
};
