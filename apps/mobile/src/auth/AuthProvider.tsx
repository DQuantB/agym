import { Session } from '@supabase/supabase-js';
import { createContext, PropsWithChildren, useContext, useEffect, useRef, useState } from 'react';

import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';

type AuthState = { configured: boolean; ready: boolean; session: Session | null; signOut: () => Promise<void> };
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!isSupabaseConfigured());
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
    supabase.auth.getSession().then(({ data }) => { if (active) { applySession(data.session); setReady(true); } });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => { if (active) { applySession(next); setReady(true); } });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  const signOut = async () => {
    const supabase = getSupabaseClient();
    generation.current += 1;
    setSession(null); // clear UI state before remote auth settles
    if (supabase) await supabase.auth.signOut();
  };

  return <AuthContext.Provider value={{ configured: isSupabaseConfigured(), ready, session, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
