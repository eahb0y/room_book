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
  created_at: string;
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const mapProfileToUser = (profile: ProfileRow): User => ({
  id: profile.id,
  email: profile.email,
  role: profile.role,
  firstName: profile.first_name ?? undefined,
  lastName: profile.last_name ?? undefined,
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
    role: 'admin' | 'user';
    firstName?: string;
    lastName?: string;
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
          role: profile.role,
          first_name: profile.firstName ?? null,
          last_name: profile.lastName ?? null,
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
  role: 'admin' | 'user';
  accessToken: string;
}) => {
  const existing = await fetchProfileById(input.userId, input.accessToken);
  if (existing) return existing;

  return upsertProfile(
    {
      id: input.userId,
      email: input.email,
      role: input.role,
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
    role: 'user',
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
      role: payload.role,
    },
    accessToken,
  );

  return mapProfileToUser(profile);
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
