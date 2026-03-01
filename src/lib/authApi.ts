import type { BusinessAccess, LoginCredentials, RegisterCredentials, User } from '@/types';
import { getSupabaseUrl } from '@/lib/supabaseConfig';
import { supabaseAuthRequest, supabaseDbRequest } from '@/lib/supabaseHttp';
import { clearAuthSession, getAuthSession, setAuthSession } from '@/lib/supabaseSession';

interface AuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: {
    id: string;
    email?: string;
    created_at?: string;
  };
}

interface SignupResponse {
  user: {
    id: string;
    email?: string;
    created_at?: string;
  } | null;
  session: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  } | null;
}

interface AuthUserResponse {
  id: string;
  email?: string;
}

interface ProfileRow {
  id: string;
  email: string;
  role: 'admin' | 'user';
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

interface OwnedVenueRow {
  id: string;
  name: string;
}

interface BusinessStaffAccessRow {
  venue_id: string;
  role: 'manager' | 'staff';
  venues: {
    name: string;
  } | null;
}

export type OAuthProvider = 'google' | 'apple';

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;

  if (typeof error === 'object' && error !== null) {
    const record = error as Record<string, unknown>;
    const candidates = [record.message, record.msg, record.detail, record.hint, record.error];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate;
      }
    }
  }

  return '';
};

const isMissingBusinessStaffSchemaError = (error: unknown) => {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes('business_staff_accounts')
    && (
      message.includes('schema cache')
      || message.includes('could not find the table')
      || message.includes('relation')
      || message.includes('does not exist')
      || message.includes('pgrst')
      || message.includes('42p01')
    )
  );
};

const decodeOAuthError = (value: string) => {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value;
  }
};

const mapProfileToUser = (profile: ProfileRow, businessAccess?: BusinessAccess | null): User => ({
  id: profile.id,
  email: profile.email,
  role: profile.role,
  firstName: profile.first_name ?? undefined,
  lastName: profile.last_name ?? undefined,
  avatarUrl: profile.avatar_url ?? null,
  businessAccess: businessAccess ?? null,
  createdAt: profile.created_at,
});

const toSession = (payload: {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}) => ({
  accessToken: payload.accessToken,
  refreshToken: payload.refreshToken,
  expiresAt: Date.now() + payload.expiresIn * 1000,
});

const fetchProfileById = async (userId: string, accessToken?: string) => {
  const rows = await supabaseDbRequest<ProfileRow[]>(
    `profiles?select=*&id=eq.${encodeURIComponent(userId)}&limit=1`,
    { method: 'GET' },
    { accessToken },
  );

  return rows[0];
};

const fetchOwnedBusinessAccess = async (userId: string, accessToken?: string): Promise<BusinessAccess | null> => {
  const rows = await supabaseDbRequest<OwnedVenueRow[]>(
    `venues?select=id,name&admin_id=eq.${encodeURIComponent(userId)}&order=created_at.asc&limit=1`,
    { method: 'GET' },
    { accessToken },
  );

  const venue = rows[0];
  if (!venue) return null;

  return {
    venueId: venue.id,
    venueName: venue.name,
    role: 'business',
    isOwner: true,
  };
};

const fetchStaffBusinessAccess = async (userId: string, accessToken?: string): Promise<BusinessAccess | null> => {
  try {
    const rows = await supabaseDbRequest<BusinessStaffAccessRow[]>(
      `business_staff_accounts?select=venue_id,role,venues(name)&user_id=eq.${encodeURIComponent(userId)}&order=created_at.asc&limit=1`,
      { method: 'GET' },
      { accessToken },
    );

    const staffAccount = rows[0];
    if (!staffAccount) return null;

    return {
      venueId: staffAccount.venue_id,
      venueName: staffAccount.venues?.name ?? undefined,
      role: staffAccount.role,
      isOwner: false,
    };
  } catch (error) {
    if (isMissingBusinessStaffSchemaError(error)) {
      return null;
    }

    throw error;
  }
};

const resolveBusinessAccess = async (userId: string, accessToken?: string) => {
  const ownedAccess = await fetchOwnedBusinessAccess(userId, accessToken);
  if (ownedAccess) return ownedAccess;
  return fetchStaffBusinessAccess(userId, accessToken);
};

const upsertProfile = async (
  profile: {
    id: string;
    email: string;
    role?: 'admin' | 'user';
    firstName?: string;
    lastName?: string;
    avatarUrl?: string | null;
  },
  accessToken: string,
) => {
  const rows = await supabaseDbRequest<ProfileRow[]>(
    'profiles?on_conflict=id',
    {
      method: 'POST',
      headers: {
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify([
        {
          id: profile.id,
          email: profile.email,
          ...(profile.role ? { role: profile.role } : {}),
          first_name: profile.firstName ?? null,
          last_name: profile.lastName ?? null,
          ...(profile.avatarUrl !== undefined ? { avatar_url: profile.avatarUrl } : {}),
        },
      ]),
    },
    { accessToken },
  );

  return rows[0];
};

const ensureProfile = async (input: {
  userId: string;
  email: string;
  accessToken: string;
  firstName?: string;
  lastName?: string;
}) => {
  const existing = await fetchProfileById(input.userId, input.accessToken);
  if (existing) return existing;

  return upsertProfile(
    {
      id: input.userId,
      email: input.email,
      role: 'user',
      firstName: input.firstName,
      lastName: input.lastName,
    },
    input.accessToken,
  );
};

const buildUserWithAccess = async (profile: ProfileRow, accessToken?: string) => {
  const businessAccess = await resolveBusinessAccess(profile.id, accessToken);
  return mapProfileToUser(profile, businessAccess);
};

export const login = async (credentials: LoginCredentials) => {
  const email = normalizeEmail(credentials.email);
  const data = await supabaseAuthRequest<AuthResponse>('/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password: credentials.password,
    }),
  });

  setAuthSession(
    toSession({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    }),
  );

  const profile = await ensureProfile({
    userId: data.user.id,
    email: data.user.email ?? email,
    accessToken: data.access_token,
  });

  return buildUserWithAccess(profile, data.access_token);
};

export const getOAuthAuthorizeUrl = (provider: OAuthProvider, redirectTo: string) => {
  const url = new URL(`${getSupabaseUrl()}/auth/v1/authorize`);
  url.searchParams.set('provider', provider);
  url.searchParams.set('redirect_to', redirectTo);
  if (provider === 'google') {
    url.searchParams.set('prompt', 'select_account');
  }
  return url.toString();
};

export const getGoogleAuthorizeUrl = (redirectTo: string) => {
  return getOAuthAuthorizeUrl('google', redirectTo);
};

export const getAppleAuthorizeUrl = (redirectTo: string) => {
  return getOAuthAuthorizeUrl('apple', redirectTo);
};

export const completeGoogleAuthFromHash = async (hash: string) => {
  const normalizedHash = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!normalizedHash) return null;

  const params = new URLSearchParams(normalizedHash);
  const oauthError = params.get('error_description') ?? params.get('error');
  if (oauthError) {
    throw new Error(decodeOAuthError(oauthError));
  }

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

  setAuthSession(
    toSession({
      accessToken,
      refreshToken,
      expiresIn,
    }),
  );

  const authUser = await supabaseAuthRequest<AuthUserResponse>(
    '/user',
    { method: 'GET' },
    { accessToken, requireAuth: true },
  );

  const userEmail = authUser.email?.trim().toLowerCase();
  if (!userEmail) {
    throw new Error('Не удалось получить email пользователя');
  }

  const profile = await ensureProfile({
    userId: authUser.id,
    email: userEmail,
    accessToken,
  });

  return buildUserWithAccess(profile, accessToken);
};

export const register = async (payload: RegisterCredentials) => {
  const email = normalizeEmail(payload.email);
  const data = await supabaseAuthRequest<SignupResponse>('/signup', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password: payload.password,
    }),
  });

  if (!data.user) {
    throw new Error('Не удалось создать пользователя');
  }

  let accessToken = data.session?.access_token;
  let refreshToken = data.session?.refresh_token;
  let expiresIn = data.session?.expires_in;

  // Some Supabase email configurations can return 200 with no session after signup.
  // Try immediate password sign-in before failing with a clear configuration hint.
  if (!accessToken || !refreshToken || !expiresIn) {
    try {
      const loginData = await supabaseAuthRequest<AuthResponse>('/token?grant_type=password', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password: payload.password,
        }),
      });

      accessToken = loginData.access_token;
      refreshToken = loginData.refresh_token;
      expiresIn = loginData.expires_in;
    } catch {
      throw new Error(
        'Аккаунт создан, но вход не выполнен. Отключите Confirm email в Supabase: Auth -> Providers -> Email.',
      );
    }
  }

  setAuthSession(
    toSession({
      accessToken,
      refreshToken,
      expiresIn,
    }),
  );

  const profile = await ensureProfile({
    userId: data.user.id,
    email: data.user.email ?? email,
    accessToken,
  });

  return buildUserWithAccess(profile, accessToken);
};

export const updateProfile = async (
  userId: string,
  payload: {
    firstName?: string;
    lastName?: string;
    avatarUrl?: string | null;
  },
) => {
  const patch: Record<string, string | null> = {};

  if (payload.firstName !== undefined) {
    const value = payload.firstName.trim();
    patch.first_name = value.length > 0 ? value : null;
  }

  if (payload.lastName !== undefined) {
    const value = payload.lastName.trim();
    patch.last_name = value.length > 0 ? value : null;
  }

  if (payload.avatarUrl !== undefined) {
    const value = payload.avatarUrl?.trim();
    patch.avatar_url = value && value.length > 0 ? value : null;
  }

  if (Object.keys(patch).length === 0) {
    const existing = await fetchProfileById(userId);
    if (!existing) {
      throw new Error('Профиль не найден');
    }
    return buildUserWithAccess(existing);
  }

  const rows = await supabaseDbRequest<ProfileRow[]>(
    `profiles?id=eq.${encodeURIComponent(userId)}`,
    {
      method: 'PATCH',
      headers: {
        Prefer: 'return=representation',
      },
      body: JSON.stringify(patch),
    },
  );

  const updated = rows[0];
  if (!updated) {
    throw new Error('Профиль не найден');
  }

  return buildUserWithAccess(updated);
};

export const refreshBusinessAccess = async (userId: string) => {
  const profile = await fetchProfileById(userId);
  if (!profile) {
    throw new Error('Профиль не найден');
  }

  return buildUserWithAccess(profile);
};

export const changePassword = async (
  email: string,
  payload: {
    currentPassword: string;
    newPassword: string;
  },
) => {
  if (!payload.currentPassword || !payload.newPassword) {
    throw new Error('Заполните все поля');
  }

  if (payload.newPassword.length < 6) {
    throw new Error('Пароль должен содержать минимум 6 символов');
  }

  if (payload.currentPassword === payload.newPassword) {
    throw new Error('Новый пароль должен отличаться от текущего');
  }

  let authData: AuthResponse;
  try {
    authData = await supabaseAuthRequest<AuthResponse>('/token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify({
        email: normalizeEmail(email),
        password: payload.currentPassword,
      }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message.toLowerCase() : '';
    if (
      message.includes('invalid login') ||
      message.includes('invalid credentials') ||
      message.includes('401') ||
      message.includes('невер')
    ) {
      throw new Error('Текущий пароль указан неверно');
    }

    throw err;
  }

  await supabaseAuthRequest(
    '/user',
    {
      method: 'PUT',
      body: JSON.stringify({
        password: payload.newPassword,
      }),
    },
    { accessToken: authData.access_token, requireAuth: true },
  );

  setAuthSession(
    toSession({
      accessToken: authData.access_token,
      refreshToken: authData.refresh_token,
      expiresIn: authData.expires_in,
    }),
  );
};


export const logout = async () => {
  const accessToken = getAuthSession()?.accessToken;
  if (accessToken) {
    try {
      await supabaseAuthRequest('/logout', { method: 'POST' }, { accessToken, requireAuth: false });
    } catch {
      // Ignore logout network errors and clear local in-memory session regardless.
    }
  }

  clearAuthSession();
};
