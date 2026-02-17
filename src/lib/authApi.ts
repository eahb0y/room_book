import type { LoginCredentials, RegisterCredentials, User } from '@/types';
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

interface ProfileRow {
  id: string;
  email: string;
  role: 'admin' | 'user';
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const mapProfileToUser = (profile: ProfileRow): User => ({
  id: profile.id,
  email: profile.email,
  role: profile.role,
  firstName: profile.first_name ?? undefined,
  lastName: profile.last_name ?? undefined,
  avatarUrl: profile.avatar_url ?? null,
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

const upsertProfile = async (
  profile: {
    id: string;
    email: string;
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
}) => {
  const existing = await fetchProfileById(input.userId, input.accessToken);
  if (existing) return existing;

  return upsertProfile(
    {
      id: input.userId,
      email: input.email,
    },
    input.accessToken,
  );
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

  return mapProfileToUser(profile);
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

  const profile = await upsertProfile(
    {
      id: data.user.id,
      email: data.user.email ?? email,
    },
    accessToken,
  );

  return mapProfileToUser(profile);
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
    return mapProfileToUser(existing);
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

  return mapProfileToUser(updated);
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
