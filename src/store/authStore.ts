import { create } from 'zustand';
import type { AuthState, User } from '@/types';
import * as authApi from '@/lib/authApi';
import { getAuthSession } from '@/lib/supabaseSession';
import { useVenueStore } from '@/store/venueStore';

const AUTH_STATE_STORAGE_KEY = 'workspace-booking-auth-state';
const isBrowser = typeof window !== 'undefined';

const isAuthError = (err: unknown) => {
  const message = err instanceof Error ? err.message.toLowerCase() : '';
  return (
    message.includes('invalid login') ||
    message.includes('invalid credentials') ||
    message.includes('401') ||
    message.includes('невер')
  );
};

const isDuplicateError = (err: unknown) => {
  const message = err instanceof Error ? err.message.toLowerCase() : '';
  return (
    message.includes('already registered') ||
    message.includes('already exists') ||
    message.includes('duplicate') ||
    message.includes('существ')
  );
};

const isUser = (value: unknown): value is User => {
  if (!value || typeof value !== 'object') return false;
  const user = value as Record<string, unknown>;

  return (
    typeof user.id === 'string' &&
    typeof user.email === 'string' &&
    typeof user.createdAt === 'string' &&
    (user.role === 'admin' || user.role === 'user') &&
    (user.firstName === undefined || typeof user.firstName === 'string') &&
    (user.lastName === undefined || typeof user.lastName === 'string') &&
    (user.avatarUrl === undefined || user.avatarUrl === null || typeof user.avatarUrl === 'string')
  );
};

const removePersistedAuthState = () => {
  if (!isBrowser) return;

  try {
    window.sessionStorage.removeItem(AUTH_STATE_STORAGE_KEY);
  } catch {
    // Ignore storage errors and keep in-memory fallback.
  }
};

const persistAuthState = (state: Pick<AuthState, 'user' | 'isAuthenticated'>) => {
  if (!isBrowser) return;

  if (!state.isAuthenticated || !state.user) {
    removePersistedAuthState();
    return;
  }

  try {
    window.sessionStorage.setItem(
      AUTH_STATE_STORAGE_KEY,
      JSON.stringify({
        user: state.user,
        isAuthenticated: true,
      }),
    );
  } catch {
    // Ignore storage errors and keep in-memory fallback.
  }
};

const readPersistedAuthState = (): Pick<AuthState, 'user' | 'isAuthenticated'> => {
  if (!isBrowser || !getAuthSession()) {
    removePersistedAuthState();
    return { user: null, isAuthenticated: false };
  }

  try {
    const raw = window.sessionStorage.getItem(AUTH_STATE_STORAGE_KEY);
    if (!raw) return { user: null, isAuthenticated: false };

    const parsed = JSON.parse(raw) as { user?: unknown; isAuthenticated?: unknown };
    if (parsed.isAuthenticated !== true || !isUser(parsed.user)) {
      removePersistedAuthState();
      return { user: null, isAuthenticated: false };
    }

    return { user: parsed.user, isAuthenticated: true };
  } catch {
    removePersistedAuthState();
    return { user: null, isAuthenticated: false };
  }
};

const initialAuthState = readPersistedAuthState();

export const useAuthStore = create<AuthState>((set, get) => ({
  user: initialAuthState.user,
  isAuthenticated: initialAuthState.isAuthenticated,

  login: async (credentials) => {
    try {
      const user = await authApi.login(credentials);
      const nextState = { user, isAuthenticated: true };
      persistAuthState(nextState);
      set(nextState);
      return true;
    } catch (err) {
      if (isAuthError(err)) return false;
      throw err;
    }
  },

  register: async (credentials) => {
    try {
      const user = await authApi.register(credentials);
      const nextState = { user, isAuthenticated: true };
      persistAuthState(nextState);
      set(nextState);
      return true;
    } catch (err) {
      if (isDuplicateError(err)) return false;
      throw err;
    }
  },

  updateProfile: async (payload) => {
    const currentUser = get().user;
    if (!currentUser) {
      throw new Error('Not authenticated');
    }

    const user = await authApi.updateProfile(currentUser.id, payload);
    const nextState = { user, isAuthenticated: true };
    persistAuthState(nextState);
    set(nextState);
    return user;
  },

  changePassword: async (payload) => {
    const currentUser = get().user;
    if (!currentUser) {
      throw new Error('Not authenticated');
    }

    await authApi.changePassword(currentUser.email, payload);
  },

  logout: async () => {
    await authApi.logout();
    const nextState = { user: null, isAuthenticated: false };
    persistAuthState(nextState);
    set(nextState);
    useVenueStore.getState().reset();
  },
}));
