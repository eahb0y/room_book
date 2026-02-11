import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthState } from '@/types';
import * as authApi from '@/lib/authApi';
import { useVenueStore } from '@/store/venueStore';

const isAuthError = (err: unknown) => {
  const message = err instanceof Error ? err.message : '';
  return message.includes('401') || message.toLowerCase().includes('невер');
};

const isDuplicateError = (err: unknown) => {
  const message = err instanceof Error ? err.message : '';
  return message.includes('400') || message.toLowerCase().includes('существ');
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
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

      createUser: async (payload) => {
        try {
          const user = await authApi.createUser(payload);
          return { success: true, user };
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Не удалось создать пользователя';
          return { success: false, error: message };
        }
      },

      logout: () => {
        set({ user: null, isAuthenticated: false });
        useVenueStore.getState().reset();
      },

      getUserByEmail: async (email) => {
        return authApi.getUserByEmail(email);
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);
