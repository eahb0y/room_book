import { getSupabasePublishableKey, getSupabaseUrl } from '@/lib/supabaseConfig';
import { getAuthSession } from '@/lib/supabaseSession';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const parsePayload = async (res: Response): Promise<unknown> => {
  const text = await res.text();
  if (!text) return undefined;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

const extractErrorMessage = (payload: unknown, fallback: string) => {
  if (typeof payload === 'string' && payload.trim()) {
    return payload;
  }

  if (isRecord(payload)) {
    const candidates = [
      payload.msg,
      payload.message,
      payload.error_description,
      payload.error,
      payload.detail,
      payload.hint,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate;
      }
    }
  }

  return fallback;
};

const mergeHeaders = (
  initHeaders: HeadersInit | undefined,
  accessToken: string | undefined,
  withJsonContentType: boolean,
) => {
  const headers = new Headers(initHeaders ?? undefined);
  headers.set('apikey', getSupabasePublishableKey());

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  if (withJsonContentType && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return headers;
};

const resolveAccessToken = (accessToken?: string, requireAuth = true) => {
  const token = accessToken ?? getAuthSession()?.accessToken;

  if (requireAuth && !token) {
    throw new Error('Пользователь не авторизован');
  }

  return token;
};

const normalizePath = (path: string) => (path.startsWith('/') ? path : `/${path}`);

const buildSupabaseNetworkError = (_url: string, _endpointType: 'auth' | 'database') =>
  'Не удалось подключиться к Supabase. Проверьте интернет, VPN/firewall и настройки URL проекта.';

const performSupabaseFetch = async (
  url: string,
  init: RequestInit,
  endpointType: 'auth' | 'database',
) => {
  try {
    return await fetch(url, init);
  } catch (err) {
    const message = err instanceof Error ? err.message.toLowerCase() : '';
    const isNetworkError =
      err instanceof TypeError || message.includes('failed to fetch') || message.includes('networkerror');

    if (isNetworkError) {
      throw new Error(buildSupabaseNetworkError(url, endpointType));
    }

    throw err;
  }
};

export const supabaseAuthRequest = async <T>(
  path: string,
  init?: RequestInit,
  options?: { accessToken?: string; requireAuth?: boolean },
): Promise<T> => {
  const normalizedPath = normalizePath(path);
  const token = resolveAccessToken(options?.accessToken, options?.requireAuth ?? false);
  const withJson = init?.body !== undefined;
  const url = `${getSupabaseUrl()}/auth/v1${normalizedPath}`;
  const res = await performSupabaseFetch(url, {
    ...init,
    headers: mergeHeaders(init?.headers, token, withJson),
  }, 'auth');

  const payload = await parsePayload(res);
  if (!res.ok) {
    throw new Error(extractErrorMessage(payload, `HTTP ${res.status}`));
  }

  return payload as T;
};

export const supabaseDbRequest = async <T>(
  path: string,
  init?: RequestInit,
  options?: { accessToken?: string; requireAuth?: boolean },
): Promise<T> => {
  const normalizedPath = normalizePath(path);
  const token = resolveAccessToken(options?.accessToken, options?.requireAuth ?? true);
  const withJson = init?.body !== undefined;
  const url = `${getSupabaseUrl()}/rest/v1${normalizedPath}`;
  const res = await performSupabaseFetch(url, {
    ...init,
    headers: mergeHeaders(init?.headers, token, withJson),
  }, 'database');

  const payload = await parsePayload(res);
  if (!res.ok) {
    throw new Error(extractErrorMessage(payload, `HTTP ${res.status}`));
  }

  return payload as T;
};
