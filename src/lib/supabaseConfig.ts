type SupabaseEnvironment = 'dev' | 'prod';

const normalizeEnvValue = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const isLocalRuntime = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  const hostname = window.location.hostname.toLowerCase();
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname.endsWith('.local');
};

const resolveSupabaseEnvironment = (): SupabaseEnvironment => {
  const explicitEnvironment = normalizeEnvValue(import.meta.env.VITE_APP_ENV)?.toLowerCase();
  if (explicitEnvironment === 'dev' || explicitEnvironment === 'development') {
    return 'dev';
  }
  if (explicitEnvironment === 'prod' || explicitEnvironment === 'production') {
    return 'prod';
  }

  if (isLocalRuntime()) {
    return 'dev';
  }

  return import.meta.env.PROD ? 'prod' : 'dev';
};

const SUPABASE_ENVIRONMENT = resolveSupabaseEnvironment();

const DEV_URL = normalizeEnvValue(import.meta.env.VITE_SUPABASE_DEV_URL);
const DEV_PUBLISHABLE_KEY =
  normalizeEnvValue(import.meta.env.VITE_SUPABASE_DEV_PUBLISHABLE_KEY) ??
  normalizeEnvValue(import.meta.env.VITE_SUPABASE_DEV_ANON_KEY);

const PROD_URL = normalizeEnvValue(import.meta.env.VITE_SUPABASE_PROD_URL);
const PROD_PUBLISHABLE_KEY =
  normalizeEnvValue(import.meta.env.VITE_SUPABASE_PROD_PUBLISHABLE_KEY) ??
  normalizeEnvValue(import.meta.env.VITE_SUPABASE_PROD_ANON_KEY);

const LEGACY_URL = normalizeEnvValue(import.meta.env.VITE_SUPABASE_URL);
const LEGACY_PUBLISHABLE_KEY =
  normalizeEnvValue(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) ??
  normalizeEnvValue(import.meta.env.VITE_SUPABASE_ANON_KEY);

const getConfiguredValues = () => {
  const supabaseUrl =
    SUPABASE_ENVIRONMENT === 'dev'
      ? DEV_URL ?? LEGACY_URL ?? PROD_URL
      : PROD_URL ?? LEGACY_URL ?? DEV_URL;
  const supabasePublishableKey =
    SUPABASE_ENVIRONMENT === 'dev'
      ? DEV_PUBLISHABLE_KEY ?? LEGACY_PUBLISHABLE_KEY ?? PROD_PUBLISHABLE_KEY
      : PROD_PUBLISHABLE_KEY ?? LEGACY_PUBLISHABLE_KEY ?? DEV_PUBLISHABLE_KEY;

  if (!supabaseUrl) {
    const expected =
      SUPABASE_ENVIRONMENT === 'dev'
        ? 'VITE_SUPABASE_DEV_URL (preferred), VITE_SUPABASE_URL (legacy), or VITE_SUPABASE_PROD_URL (fallback)'
        : 'VITE_SUPABASE_PROD_URL (preferred), VITE_SUPABASE_URL (legacy), or VITE_SUPABASE_DEV_URL (fallback)';
    throw new Error(`Supabase URL is not configured for ${SUPABASE_ENVIRONMENT}. Set ${expected}.`);
  }

  if (!supabasePublishableKey) {
    const expected =
      SUPABASE_ENVIRONMENT === 'dev'
        ? 'VITE_SUPABASE_DEV_PUBLISHABLE_KEY (preferred), VITE_SUPABASE_PUBLISHABLE_KEY (legacy), or VITE_SUPABASE_PROD_PUBLISHABLE_KEY (fallback)'
        : 'VITE_SUPABASE_PROD_PUBLISHABLE_KEY (preferred), VITE_SUPABASE_PUBLISHABLE_KEY (legacy), or VITE_SUPABASE_DEV_PUBLISHABLE_KEY (fallback)';
    throw new Error(`Supabase publishable key is not configured for ${SUPABASE_ENVIRONMENT}. Set ${expected}.`);
  }

  return {
    supabaseUrl,
    supabasePublishableKey,
  };
};

export const getSupabaseUrl = () => {
  return getConfiguredValues().supabaseUrl.replace(/\/+$/, '');
};

export const getSupabasePublishableKey = () => {
  return getConfiguredValues().supabasePublishableKey;
};

export const getSupabaseEnvironment = () => {
  return SUPABASE_ENVIRONMENT;
};
