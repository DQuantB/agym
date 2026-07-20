import { useEffect, useState } from 'react';
import { getSupabaseClient } from '../lib/supabase';

type ConsentDetails = {
  authorization_id: string;
  client: { name: string; uri: string; logo_uri: string };
  redirect_uri: string;
  scope: string;
};

function authorizationIdFromLocation() {
  return new URLSearchParams(window.location.search).get('authorization_id')?.trim() ?? '';
}

function redirect(url: string) {
  window.location.assign(url);
}

export function OAuthConsent() {
  const authorizationId = authorizationIdFromLocation();
  const [details, setDetails] = useState<ConsentDetails | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authorizationId) return;

    void getSupabaseClient().auth.oauth.getAuthorizationDetails(authorizationId).then(({ data, error }) => {
      if (error || !data) {
        setMessage(error?.message ?? 'AGym could not load this OAuth authorization request.');
        return;
      }
      if ('redirect_url' in data) {
        redirect(data.redirect_url);
        return;
      }
      setDetails(data);
    });
  }, [authorizationId]);

  if (!authorizationId) {
    return <main className="auth-shell"><p role="status">This OAuth authorization request is missing its identifier. Return to the MCP client and start again.</p></main>;
  }

  async function decide(action: 'approve' | 'deny') {
    if (!details) return;
    setSubmitting(true);
    setMessage(null);
    const result = action === 'approve'
      ? await getSupabaseClient().auth.oauth.approveAuthorization(details.authorization_id, { skipBrowserRedirect: true })
      : await getSupabaseClient().auth.oauth.denyAuthorization(details.authorization_id, { skipBrowserRedirect: true });
    setSubmitting(false);

    if (result.error || !result.data?.redirect_url) {
      setMessage(result.error?.message ?? 'AGym could not complete this OAuth authorization request.');
      return;
    }
    redirect(result.data.redirect_url);
  }

  return (
    <main className="auth-shell">
      <div className="poster-word">AGYM</div>
      <h1>Approve MCP access</h1>
      {details && (
        <>
          <p><strong>{details.client.name || 'An MCP client'}</strong> requests an AGym OAuth token.</p>
          <p className="microcopy">It will return to <code>{details.redirect_uri}</code> and request OIDC scopes: <code>{details.scope || 'none'}</code>.</p>
          <p className="microcopy">AGym data remains separately protected: this token alone grants no raw-context or plan-writing access. You must enable each AGym action in Plans, and can revoke it there at any time.</p>
          <div className="button-row">
            <button type="button" onClick={() => void decide('deny')} disabled={submitting}>Deny</button>
            <button type="button" className="primary-action" onClick={() => void decide('approve')} disabled={submitting}>{submitting ? 'Completing…' : 'Approve OAuth token'}</button>
          </div>
        </>
      )}
      {message && <p role="status" className="microcopy">{message}</p>}
    </main>
  );
}
