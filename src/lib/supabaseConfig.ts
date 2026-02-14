const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim();
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ??
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

const assertConfigured = () => {
  if (!SUPABASE_URL) {
    throw new Error('VITE_SUPABASE_URL is not configured');
  }

  if (!SUPABASE_PUBLISHABLE_KEY) {
    throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY is not configured');
  }
};

export const getSupabaseUrl = () => {
  assertConfigured();
  return SUPABASE_URL.replace(/\/+$/, '');
};

export const getSupabasePublishableKey = () => {
  assertConfigured();
  return SUPABASE_PUBLISHABLE_KEY;
};
