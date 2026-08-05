import { isAuthRetryableFetchError, Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { createContext, PropsWithChildren, useContext, useEffect, useRef, useState } from 'react';

import { createAuthRedirectUrl, getAuthorizationCodeFromUrl, getAuthSessionTokensFromUrl } from '@/auth/authRedirect';
import { resolveSessionTransition } from '@/auth/sessionTransition';
import { clearAccountLocalExecutionDrafts } from '@/features/workout/localDraftStore';
import { clearAccountScreenCache } from '@/lib/localCache';
import { getSupabaseClient, isSupabaseConfigured, readPersistedSession } from '@/lib/supabase';

type AuthState = {
  configured: boolean;
  ready: boolean;
  session: Session | null;
  offlineRestored: boolean;
  authError: string | null;
  requestMagicLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
};
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!isSupabaseConfigured());
  const [authError, setAuthError] = useState<string | null>(null);
  const [offlineRestored, setOfflineRestored] = useState(false);
  const generation = useRef(0);
  const previousUserId = useRef<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    let active = true;
    // Local drafts/cache are cleared only on switched_account/signed_out
    // transitions, and only ever fire from a genuine onAuthStateChange
    // SIGNED_OUT event or an explicit account switch — never from a bare
    // connectivity failure. Verified against installed auth-js: when a
    // token refresh fails with a retryable (network) error, GoTrueClient
    // skips _removeSession() entirely and never emits SIGNED_OUT, so a
    // transient offline blip cannot reach this branch. The one path that
    // *could* hand us `session: null` from a network failure is this
    // provider's own bootstrap() below, which is handled by restoring the
    // persisted session instead of calling applySession(null).
    const applySession = (next: Session | null, options?: { offline?: boolean }) => {
      generation.current += 1;
      const nextUserId = next?.user.id ?? null;
      const transition = resolveSessionTransition(previousUserId.current, nextUserId);
      if (transition === 'switched_account' || transition === 'signed_out') {
        void clearAccountLocalExecutionDrafts(previousUserId.current!);
        void clearAccountScreenCache(previousUserId.current!);
      }
      previousUserId.current = nextUserId;
      setOfflineRestored(Boolean(options?.offline));
      setSession(next);
    };
    const consumeAuthUrl = async (url: string | null) => {
      const code = getAuthorizationCodeFromUrl(url);
      const tokens = getAuthSessionTokensFromUrl(url);
      if (!code && !tokens) return;

      const { error } = code
        ? await supabase.auth.exchangeCodeForSession(code)
        : await supabase.auth.setSession({ access_token: tokens!.accessToken, refresh_token: tokens!.refreshToken });
      if (active && error) setAuthError('AGYM could not complete that sign-in link. Request a new one and try again.');
    };
    const bootstrap = async () => {
      try {
        await consumeAuthUrl(await Linking.getInitialURL());
        const { data, error } = await supabase.auth.getSession();
        if (active) {
          if (!data.session && error && isAuthRetryableFetchError(error)) {
            // getSession() couldn't reach the network to refresh an expired
            // access token. The session is still on disk — restore it so
            // offline-cached screens have someone to scope their cache to.
            const persisted = await readPersistedSession();
            if (persisted) {
              applySession(persisted, { offline: true });
            } else {
              applySession(null);
              setAuthError('AGYM could not restore your private session. Please sign in again.');
            }
          } else {
            applySession(data.session);
            if (error) setAuthError('AGYM could not restore your private session. Please sign in again.');
          }
        }
      } catch {
        if (active) setAuthError('AGYM could not restore your private session. Please sign in again.');
      } finally {
        if (active) setReady(true);
      }
    };

    void bootstrap();
    const authSubscription = supabase.auth.onAuthStateChange((_event, next) => {
      if (active) {
        applySession(next);
        setReady(true);
      }
    });
    const linkSubscription = Linking.addEventListener('url', ({ url }) => {
      void consumeAuthUrl(url);
    });

    return () => {
      active = false;
      authSubscription.data.subscription.unsubscribe();
      linkSubscription.remove();
    };
  }, []);

  const requestMagicLink = async (email: string) => {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('AGYM needs its public Supabase configuration before you can sign in.');

    setAuthError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: createAuthRedirectUrl(Linking.createURL) },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const supabase = getSupabaseClient();
    generation.current += 1;
    setSession(null); // Clear the private view before remote auth settles.
    setOfflineRestored(false);
    setAuthError(null);
    if (supabase) await supabase.auth.signOut();
  };

  return <AuthContext.Provider value={{ configured: isSupabaseConfigured(), ready, session, offlineRestored, authError, requestMagicLink, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
