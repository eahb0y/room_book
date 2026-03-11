const normalizeEnvValue = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const resolveAppEnvironment = (): 'dev' | 'prod' => {
  const explicit = normalizeEnvValue(import.meta.env.VITE_APP_ENV);

  if (explicit === 'dev' || explicit === 'prod') {
    return explicit;
  }

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'dev';
    }
  }

  return 'prod';
};

const APP_ENVIRONMENT = resolveAppEnvironment();

const resolveApiBaseUrl = () => {
  const explicit = normalizeEnvValue(import.meta.env.VITE_API_BASE_URL);

  if (explicit) {
    return explicit.replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname.toLowerCase();

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:3000';
    }

    return window.location.origin.replace(/\/+$/, '');
  }

  return 'http://localhost:3000';
};

const API_BASE_URL = resolveApiBaseUrl();

export const getApiBaseUrl = () => API_BASE_URL;

export const getAppEnvironment = () => APP_ENVIRONMENT;
