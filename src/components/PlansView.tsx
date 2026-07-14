import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '../lib/supabase';

type AuthorizationAction = 'read_context' | 'write_proposed_plan';

interface PlanRow {
  id: string;
  raw_plan_text: string;
  plan_data: Record<string, unknown>;
  provenance: 'agent_written_plan';
  status: 'proposed' | 'active' | 'superseded' | 'archived';
  source_client: string;
  created_at: string;
}

interface AuthorizationRow {
  id: string;
  agent_identifier: string;
  action: AuthorizationAction;
  granted_at: string;
  revoked_at: string | null;
}

const scopes: { action: AuthorizationAction; title: string; description: string }[] = [
  {
    action: 'read_context',
    title: 'Read bounded context',
    description: 'Hermes may read bounded raw self-reports and confirmed outcomes when you ask it to help. Each MCP request has a record limit.'
  },
  {
    action: 'write_proposed_plan',
    title: 'Write proposed plans',
    description: 'Hermes may save a plan proposal for you to review. It cannot mark it active or confirm outcomes.',
  },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function requireResult<T>(result: { data: T | null; error: { message: string } | null }, action: string): T {
  if (result.error) throw new Error(`AGym could not ${action}: ${result.error.message}`);
  if (result.data === null) throw new Error(`AGym could not ${action}: no data was returned.`);
  return result.data;
}

export function PlansView({ client = getSupabaseClient() }: { client?: SupabaseClient }) {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [authorizations, setAuthorizations] = useState<AuthorizationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [plansResult, authorizationsResult] = await Promise.all([
        client.from('plans').select('id, raw_plan_text, plan_data, provenance, status, source_client, created_at').is('deleted_at', null).order('created_at', { ascending: false }),
        client.from('agent_authorizations').select('id, agent_identifier, action, granted_at, revoked_at').eq('agent_identifier', 'hermes').order('granted_at', { ascending: false }),
      ]);
      setPlans(requireResult(plansResult, 'load proposed plans') as PlanRow[]);
      setAuthorizations(requireResult(authorizationsResult, 'load Hermes permissions') as AuthorizationRow[]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'AGym could not load plans and permissions.');
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  function activeAuthorization(action: AuthorizationAction) {
    return authorizations.find((authorization) => authorization.action === action && authorization.revoked_at === null);
  }

  async function grant(action: AuthorizationAction) {
    setMessage(null);
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) {
      setMessage(`AGym could not verify your signed-in account: ${error?.message ?? 'no active user.'}`);
      return;
    }
    const result = await client.from('agent_authorizations').insert({
      user_id: data.user.id,
      agent_identifier: 'hermes',
      action,
      scope: { version: 1 },
    });
    if (result.error) {
      setMessage(`AGym could not grant Hermes permission: ${result.error.message}`);
      return;
    }
    setMessage('Hermes permission granted. It takes effect on the next MCP call.');
    await load();
  }

  async function revoke(authorization: AuthorizationRow) {
    setMessage(null);
    const result = await client.from('agent_authorizations').update({ revoked_at: new Date().toISOString() }).eq('id', authorization.id).is('revoked_at', null);
    if (result.error) {
      setMessage(`AGym could not revoke Hermes permission: ${result.error.message}`);
      return;
    }
    setMessage('Hermes permission revoked. Future MCP calls using this scope will be denied.');
    await load();
  }

  return (
    <section className="panel" aria-labelledby="plans-heading">
      <h2 id="plans-heading">Plans & Hermes access</h2>
      <p className="warning">Plans are agent-authored proposals, not confirmed outcomes, medical advice, or automatically active instructions.</p>

      <section aria-labelledby="hermes-access-heading">
        <h3 id="hermes-access-heading">Hermes permissions</h3>
        <p className="microcopy">Each permission is separate and revocable. AGym keeps the grant/revocation record under your account.</p>
        {scopes.map((scope) => {
          const authorization = activeAuthorization(scope.action);
          return (
            <article className="authorization-card" key={scope.action}>
              <div><h4>{scope.title}</h4><p>{scope.description}</p></div>
              {authorization
                ? <button className="danger" onClick={() => void revoke(authorization)}>Revoke</button>
                : <button className="primary" onClick={() => void grant(scope.action)}>Allow Hermes</button>}
            </article>
          );
        })}
      </section>

      <section aria-labelledby="agent-plans-heading">
        <h3 id="agent-plans-heading">Agent-authored plans</h3>
        {loading && <p className="microcopy">Loading your plans…</p>}
        {!loading && plans.length === 0 && <p className="microcopy">No agent-authored proposals yet.</p>}
        {!loading && plans.map((plan) => (
          <article className="plan-card" key={plan.id}>
            <div className="plan-card__meta"><span className="badge">{plan.status}</span><span>From {plan.source_client}</span><span>{formatDate(plan.created_at)}</span></div>
            <p>{plan.raw_plan_text}</p>
            <p className="microcopy">Provenance: agent-written plan · Status: {plan.status}</p>
          </article>
        ))}
      </section>
      {message && <p role="status" className="microcopy">{message}</p>}
    </section>
  );
}
