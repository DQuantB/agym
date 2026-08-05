import 'react-native-url-polyfill/auto';

import * as SecureStore from 'expo-secure-store';
import { createClient, Session, SupabaseClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const storageKey = 'agym.supabase.auth';

const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

let client: SupabaseClient | null | undefined;

export function getSupabaseClient(): SupabaseClient | null {
  if (client !== undefined) return client;
  if (!url || !key) return (client = null);

  client = createClient(url, key, {
    auth: {
      storage: secureStorage,
      storageKey,
      autoRefreshToken: true,
      persistSession: true,
      // Android custom-scheme launches can discard an implicit URL fragment.
      // PKCE returns the one-time code in the query string, which our native
      // AuthProvider exchanges explicitly after receiving the deep link.
      flowType: 'pkce',
      detectSessionInUrl: false,
    },
  });
  return client;
}

export const isSupabaseConfigured = () => Boolean(url && key);

/**
 * Reads the session supabase-js already persisted under `storageKey`,
 * bypassing the network. Used only as a fallback when `getSession()` fails
 * with a connectivity error and the SDK hands back `session: null` even
 * though a session is still on disk (see AuthProvider's bootstrap). Since
 * this app does not configure `userStorage`, supabase-js stores the full
 * session object — including `user` — at this single key.
 */
export async function readPersistedSession(): Promise<Session | null> {
  try {
    const raw = await SecureStore.getItemAsync(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { user?: { id?: unknown } } | null;
    if (!parsed || typeof parsed !== 'object' || typeof parsed.user?.id !== 'string') return null;
    return parsed as unknown as Session;
  } catch {
    return null;
  }
}
