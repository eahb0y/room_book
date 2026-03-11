import { getApiBaseUrl } from '@/lib/apiConfig';
import { clearAuthSession, getAuthSession, setAuthSession } from '@/lib/supabaseSession';

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
};

type AuthOptions = {
  accessToken?: string;
  requireAuth?: boolean;
};

type BackendSessionResponse = {
  session?: {
    accessToken: string;
    refreshToken: string;
    expiresAt?: string;
    expiresIn?: number;
  };
};

const getErrorMessage = (payload: unknown, status: number) => {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const candidates = [record.message, record.msg, record.detail, record.hint, record.error];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }
  }

  if (typeof payload === 'string' && payload.trim()) {
    return payload.trim();
  }

  return `HTTP ${status}`;
};

const decodeBody = async (response: Response) => {
  const text = await response.text();
  if (!text.trim()) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const persistSessionFromResponse = (payload: BackendSessionResponse) => {
  const session = payload.session;
  if (!session?.accessToken || !session?.refreshToken) {
    return;
  }

  const expiresAt = typeof session.expiresAt === 'string'
    ? new Date(session.expiresAt).getTime()
    : Number.NaN;
  const fallbackExpiresAt = typeof session.expiresIn === 'number'
    ? Date.now() + session.expiresIn * 1000
    : Number.NaN;
  const normalizedExpiresAt = Number.isFinite(expiresAt)
    ? expiresAt
    : Number.isFinite(fallbackExpiresAt)
      ? fallbackExpiresAt
      : Date.now() + 60 * 60 * 1000;

  setAuthSession({
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresAt: normalizedExpiresAt,
  });
};

const refreshStoredSession = async () => {
  const currentSession = getAuthSession();

  if (!currentSession?.refreshToken) {
    clearAuthSession();
    return null;
  }

  const response = await fetch(`${getApiBaseUrl()}/api/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      refreshToken: currentSession.refreshToken,
    }),
  });

  const payload = await decodeBody(response);

  if (!response.ok) {
    clearAuthSession();
    throw new Error(getErrorMessage(payload, response.status));
  }

  persistSessionFromResponse(payload as BackendSessionResponse);
  return getAuthSession();
};

export const backendRequest = async <T>(
  path: string,
  options: RequestOptions = {},
  authOptions: AuthOptions = {},
  allowRefresh = true,
): Promise<T> => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const session = getAuthSession();
  const accessToken = authOptions.accessToken ?? session?.accessToken ?? '';
  const requireAuth = authOptions.requireAuth ?? true;

  if (requireAuth && !accessToken) {
    throw new Error('Пользователь не авторизован');
  }

  const response = await fetch(`${getApiBaseUrl()}${normalizedPath}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(options.headers ?? {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const payload = await decodeBody(response);

  if (response.status === 401 && allowRefresh && requireAuth && session?.refreshToken) {
    await refreshStoredSession();
    return backendRequest<T>(normalizedPath, options, authOptions, false);
  }

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, response.status));
  }

  if (payload && typeof payload === 'object' && 'session' in (payload as Record<string, unknown>)) {
    persistSessionFromResponse(payload as BackendSessionResponse);
  }

  return payload as T;
};
