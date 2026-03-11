import type { LoginCredentials, RegisterCredentials, User } from '@/types';
import { getApiBaseUrl } from '@/lib/apiConfig';
import { backendRequest } from '@/lib/backendHttp';
import { clearAuthSession, getAuthSession } from '@/lib/supabaseSession';

interface AuthPayload {
  session: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    expiresAt: string;
  };
  user: User;
}

export type OAuthProvider = 'google' | 'apple';

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const decodeOAuthError = (value: string) => {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value;
  }
};

const normalizeOAuthErrorMessage = (message: string, errorCode?: string | null) => {
  const normalizedCode = errorCode?.trim().toLowerCase() ?? '';
  const normalizedMessage = message.trim().toLowerCase();

  if (
    normalizedCode === 'bad_oauth_state'
    || normalizedMessage.includes('oauth state not found')
    || normalizedMessage.includes('oauth state')
    || normalizedMessage.includes('state not found or expired')
  ) {
    return 'Сессия входа через Google истекла или была прервана. Попробуйте войти ещё раз.';
  }

  if (normalizedMessage.includes('access denied')) {
    return 'Вход через Google был отменён.';
  }

  if (normalizedMessage.includes('invalid request')) {
    return 'Не удалось завершить вход через Google. Попробуйте ещё раз.';
  }

  return message.trim();
};

export const getOAuthCallbackErrorMessage = (value: string) => {
  const normalizedValue = value.startsWith('#') || value.startsWith('?') ? value.slice(1) : value;
  if (!normalizedValue) return null;

  const params = new URLSearchParams(normalizedValue);
  const rawError =
    params.get('oauth_error')
    ?? params.get('error_description')
    ?? params.get('error');

  if (!rawError) return null;

  const decodedError = decodeOAuthError(rawError);
  const errorCode = params.get('error_code');
  return normalizeOAuthErrorMessage(decodedError, errorCode);
};

export const login = async (credentials: LoginCredentials) => {
  const payload = await backendRequest<AuthPayload>(
    '/api/auth/login',
    {
      method: 'POST',
      body: {
        email: normalizeEmail(credentials.email),
        password: credentials.password,
      },
    },
    { requireAuth: false },
  );

  return payload.user;
};

export const getOAuthAuthorizeUrl = (provider: OAuthProvider, redirectTo: string) => {
  const url = new URL(`${getApiBaseUrl()}/api/auth/oauth/authorize`);
  url.searchParams.set('provider', provider);
  url.searchParams.set('redirectTo', redirectTo);
  return url.toString();
};

export const getGoogleAuthorizeUrl = (redirectTo: string) => getOAuthAuthorizeUrl('google', redirectTo);

export const getAppleAuthorizeUrl = (redirectTo: string) => getOAuthAuthorizeUrl('apple', redirectTo);

export const completeGoogleAuthFromHash = async (hash: string) => {
  const normalizedHash = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!normalizedHash) return null;

  const oauthError = getOAuthCallbackErrorMessage(normalizedHash);
  if (oauthError) {
    throw new Error(oauthError);
  }

  const params = new URLSearchParams(normalizedHash);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  const expiresInValue = params.get('expires_in');

  if (!accessToken && !refreshToken && !expiresInValue) {
    return null;
  }

  const expiresIn = Number(expiresInValue);
  if (!accessToken || !refreshToken || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new Error('Не удалось завершить вход через OAuth');
  }

  const payload = await backendRequest<AuthPayload>(
    '/api/auth/session',
    {
      method: 'POST',
      body: {
        accessToken,
        refreshToken,
        expiresIn,
      },
    },
    { requireAuth: false },
  );

  return payload.user;
};

export const register = async (payload: RegisterCredentials) => {
  const result = await backendRequest<AuthPayload>(
    '/api/auth/register',
    {
      method: 'POST',
      body: {
        email: normalizeEmail(payload.email),
        password: payload.password,
      },
    },
    { requireAuth: false },
  );

  return result.user;
};

export const updateProfile = async (
  _userId: string,
  payload: {
    firstName?: string;
    lastName?: string;
    avatarUrl?: string | null;
  },
) => {
  return backendRequest<User>(
    '/api/profile/me',
    {
      method: 'PATCH',
      body: payload,
    },
  );
};

export const refreshBusinessAccess = async (_userId: string) => {
  return backendRequest<User>('/api/auth/me', { method: 'GET' });
};

export const changePassword = async (
  _email: string,
  payload: {
    currentPassword: string;
    newPassword: string;
  },
) => {
  await backendRequest<{ message: string }>(
    '/api/profile/change-password',
    {
      method: 'POST',
      body: payload,
    },
  );
};

export const logout = async () => {
  const accessToken = getAuthSession()?.accessToken;

  if (accessToken) {
    try {
      await backendRequest<{ success: boolean }>(
        '/api/auth/logout',
        { method: 'POST' },
        { accessToken, requireAuth: false },
      );
    } catch {
      // Ignore logout network errors and clear local session regardless.
    }
  }

  clearAuthSession();
};
