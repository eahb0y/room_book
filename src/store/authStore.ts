import { create } from 'zustand';
import type { AuthState, User } from '@/types';
import * as authApi from '@/lib/authApi';
import { getAuthSession } from '@/lib/supabaseSession';
import { useVenueStore } from '@/store/venueStore';

const AUTH_STATE_STORAGE_KEY = 'workspace-booking-auth-state';
const LEGACY_AUTH_STATE_STORAGE_KEY = AUTH_STATE_STORAGE_KEY;
const isBrowser = typeof window !== 'undefined';
const isPortal = (value: unknown): value is 'user' | 'business' => value === 'user' || value === 'business';
const resolvePortalByRole = (user: User): AuthState['portal'] => (user.role === 'admin' ? 'business' : 'user');

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
    window.localStorage.removeItem(AUTH_STATE_STORAGE_KEY);
    window.sessionStorage.removeItem(LEGACY_AUTH_STATE_STORAGE_KEY);
  } catch {
    // Ignore storage errors and keep in-memory fallback.
  }
};

const persistAuthState = (state: Pick<AuthState, 'user' | 'isAuthenticated' | 'portal'>) => {
  if (!isBrowser) return;

  if (!state.isAuthenticated || !state.user) {
    removePersistedAuthState();
    return;
  }

  const portal = state.portal ?? resolvePortalByRole(state.user);
  try {
    window.localStorage.setItem(
      AUTH_STATE_STORAGE_KEY,
      JSON.stringify({
        user: state.user,
        isAuthenticated: true,
        portal,
      }),
    );
  } catch {
    // Ignore storage errors and keep in-memory fallback.
  }
};

const readPersistedAuthState = (): Pick<AuthState, 'user' | 'isAuthenticated' | 'portal'> => {
  if (!isBrowser || !getAuthSession()) {
    removePersistedAuthState();
    return { user: null, isAuthenticated: false, portal: null };
  }

  try {
    const localRaw = window.localStorage.getItem(AUTH_STATE_STORAGE_KEY);
    const legacyRaw = window.sessionStorage.getItem(LEGACY_AUTH_STATE_STORAGE_KEY);
    const raw = localRaw ?? legacyRaw;
    if (!raw) return { user: null, isAuthenticated: false, portal: null };

    const parsed = JSON.parse(raw) as { user?: unknown; isAuthenticated?: unknown; portal?: unknown };
    if (parsed.isAuthenticated !== true || !isUser(parsed.user)) {
      removePersistedAuthState();
      return { user: null, isAuthenticated: false, portal: null };
    }

    if (!localRaw && legacyRaw) {
      persistAuthState({ user: parsed.user, isAuthenticated: true, portal: isPortal(parsed.portal) ? parsed.portal : null });
      try {
        window.sessionStorage.removeItem(LEGACY_AUTH_STATE_STORAGE_KEY);
      } catch {
        // Ignore cleanup errors.
      }
    }

    const portal = isPortal(parsed.portal) ? parsed.portal : resolvePortalByRole(parsed.user);
    return { user: parsed.user, isAuthenticated: true, portal };
  } catch {
    removePersistedAuthState();
    return { user: null, isAuthenticated: false, portal: null };
  }
};

const initialAuthState = readPersistedAuthState();

export const useAuthStore = create<AuthState>((set, get) => ({
  user: initialAuthState.user,
  isAuthenticated: initialAuthState.isAuthenticated,
  portal: initialAuthState.portal,

  login: async (credentials) => {
    try {
      const user = await authApi.login(credentials);
      const nextState = { user, isAuthenticated: true, portal: resolvePortalByRole(user) };
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
      const nextState = { user, isAuthenticated: true, portal: resolvePortalByRole(user) };
      persistAuthState(nextState);
      set(nextState);
      return true;
    } catch (err) {
      if (isDuplicateError(err)) return false;
      throw err;
    }
  },

  startGoogleAuth: (redirectPath) => {
    if (typeof window === 'undefined') return;
    const destination = redirectPath?.trim() ? redirectPath : '/login';
    const redirectTo = `${window.location.origin}${destination}`;
    const url = authApi.getGoogleAuthorizeUrl(redirectTo);
    window.location.assign(url);
  },

  startAppleAuth: (redirectPath) => {
    if (typeof window === 'undefined') return;
    const destination = redirectPath?.trim() ? redirectPath : '/login';
    const redirectTo = `${window.location.origin}${destination}`;
    const url = authApi.getAppleAuthorizeUrl(redirectTo);
    window.location.assign(url);
  },

  completeGoogleAuth: async (hash) => {
    const user = await authApi.completeGoogleAuthFromHash(hash);
    if (!user) return false;
    const nextState = { user, isAuthenticated: true, portal: resolvePortalByRole(user) };
    persistAuthState(nextState);
    set(nextState);
    return true;
  },

  setPortal: (portal) => {
    const currentUser = get().user;
    const isAuthenticated = get().isAuthenticated;
    set({ portal });
    persistAuthState({ user: currentUser, isAuthenticated, portal });
  },

  updateProfile: async (payload) => {
    const currentUser = get().user;
    if (!currentUser) {
      throw new Error('Not authenticated');
    }

    const user = await authApi.updateProfile(currentUser.id, payload);
    const nextState = { user, isAuthenticated: true, portal: get().portal ?? resolvePortalByRole(user) };
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
    const nextState = { user: null, isAuthenticated: false, portal: null };
    persistAuthState(nextState);
    set(nextState);
    useVenueStore.getState().reset();
  },
}));
