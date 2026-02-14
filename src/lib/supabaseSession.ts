export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

let currentSession: AuthSession | null = null;

export const setAuthSession = (session: AuthSession | null) => {
  currentSession = session;
};

export const getAuthSession = () => currentSession;

export const clearAuthSession = () => {
  currentSession = null;
};
