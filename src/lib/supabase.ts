import { createClient, type SupabaseClient } from '@supabase/supabase-js';

interface PublicSupabaseEnv {
  [key: string]: string | boolean | undefined;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

let client: SupabaseClient | null = null;

export function getSupabaseConfiguration(env: PublicSupabaseEnv = import.meta.env as unknown as PublicSupabaseEnv): { url: string; publishableKey: string } | null {
  const url = env.VITE_SUPABASE_URL?.trim();
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !publishableKey) return null;

  return { url, publishableKey };
}

export function getSupabaseClient(): SupabaseClient {
  if (client) return client;

  const configuration = getSupabaseConfiguration();
  if (!configuration) {
    throw new Error('AGym is missing its public Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local.');
  }

  client = createClient(configuration.url, configuration.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });

  return client;
}
