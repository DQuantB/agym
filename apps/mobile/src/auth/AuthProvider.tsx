import { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { createContext, PropsWithChildren, useContext, useEffect, useRef, useState } from 'react';

import { createAuthRedirectUrl, getAuthorizationCodeFromUrl, getAuthSessionTokensFromUrl } from '@/auth/authRedirect';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';

type AuthState = {
  configured: boolean;
  ready: boolean;
  session: Session | null;
  authError: string | null;
  requestMagicLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
};
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!isSupabaseConfigured());
  const [authError, setAuthError] = useState<string | null>(null);
  const generation = useRef(0);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    let active = true;
    const applySession = (next: Session | null) => {
      generation.current += 1;
      // Account-scoped feature stores/outboxes must subscribe here and clear synchronously.
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
          applySession(data.session);
          if (error) setAuthError('AGYM could not restore your private session. Please sign in again.');
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
    setAuthError(null);
    if (supabase) await supabase.auth.signOut();
  };

  return <AuthContext.Provider value={{ configured: isSupabaseConfigured(), ready, session, authError, requestMagicLink, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
