import type { User, LoginCredentials, RegisterCredentials } from '@/types';
import { request } from '@/lib/apiClient';

export const login = async (credentials: LoginCredentials) => {
  const data = await request<{ user: User }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
  return data.user;
};

export const register = async (payload: RegisterCredentials) => {
  const data = await request<{ user: User }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.user;
};

export const createUser = async (payload: {
  email: string;
  password: string;
  role?: 'admin' | 'user';
  firstName?: string;
  lastName?: string;
}) => {
  const data = await request<{ user: User }>('/api/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.user;
};

export const getUserByEmail = async (email: string) => {
  try {
    const data = await request<{ user: User }>(`/api/users/by-email?email=${encodeURIComponent(email)}`);
    return data.user;
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (message.includes('404')) return undefined;
    if (message.toLowerCase().includes('не найден')) return undefined;
    throw err;
  }
};
