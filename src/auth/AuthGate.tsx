import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseClient, getSupabaseConfiguration } from '../lib/supabase';

export function AuthGate({ children }: { children: ReactNode }) {
  const configured = getSupabaseConfiguration() !== null;
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(configured);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!configured) return;

    const supabase = getSupabaseClient();
    void supabase.auth.getSession().then(({ data, error }) => {
      setUser(data.session?.user ?? null);
      setMessage(error ? 'AGym could not restore your session. Please sign in again.' : null);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => data.subscription.unsubscribe();
  }, [configured]);

  async function requestSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim();
    if (!normalizedEmail) return;

    setSubmitting(true);
    setMessage(null);
    const { error } = await getSupabaseClient().auth.signInWithOtp({
      email: normalizedEmail,
      options: { emailRedirectTo: window.location.origin },
    });
    setSubmitting(false);
    setMessage(error ? error.message : 'Check your email for the secure AGym sign-in link. Access is invite-only.');
  }

  async function signOut() {
    await getSupabaseClient().auth.signOut();
  }

  if (!configured) {
    return <main className="auth-shell"><h1>AGYM configuration needed</h1><p>Missing public Supabase configuration. Add the VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY values to your local <code>.env.local</code> file.</p></main>;
  }

  if (loading) {
    return <main className="auth-shell"><p>Restoring your private AGym session…</p></main>;
  }

  if (!user) {
    return (
      <main className="auth-shell">
        <div className="poster-word">AGYM</div>
        <h1>Private alpha access</h1>
        <p>AGym is invite-only. Enter the email address that received an AGym invitation or sign-in link.</p>
        <form onSubmit={requestSignIn}>
          <label htmlFor="agym-email">Email address</label>
          <input id="agym-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          <button type="submit" disabled={submitting}>{submitting ? 'Sending…' : 'Email me a sign-in link'}</button>
        </form>
        {message && <p role="status" className="microcopy">{message}</p>}
      </main>
    );
  }

  return (
    <>
      <div className="session-bar"><span>Signed in as {user.email ?? 'invited user'}</span><button onClick={() => void signOut()}>Sign out</button></div>
      {children}
    </>
  );
}
