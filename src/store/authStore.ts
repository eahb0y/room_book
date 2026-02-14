import { create } from 'zustand';
import type { AuthState } from '@/types';
import * as authApi from '@/lib/authApi';
import { useVenueStore } from '@/store/venueStore';

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

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,

  login: async (credentials) => {
    try {
      const user = await authApi.login(credentials);
      set({ user, isAuthenticated: true });
      return true;
    } catch (err) {
      if (isAuthError(err)) return false;
      throw err;
    }
  },

  register: async (credentials) => {
    try {
      const user = await authApi.register(credentials);
      set({ user, isAuthenticated: true });
      return true;
    } catch (err) {
      if (isDuplicateError(err)) return false;
      throw err;
    }
  },

  logout: async () => {
    await authApi.logout();
    set({ user: null, isAuthenticated: false });
    useVenueStore.getState().reset();
  },
}));
