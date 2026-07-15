import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '../lib/supabase';

type AuthorizationAction = 'read_context' | 'write_proposed_plan';

interface AgentClient {
  id: 'hermes' | 'claude-code' | 'codex';
  label: 'Hermes' | 'Claude Code' | 'Codex';
}

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

const agentClients: AgentClient[] = [
  { id: 'hermes', label: 'Hermes' },
  { id: 'claude-code', label: 'Claude Code' },
  { id: 'codex', label: 'Codex' },
];

const scopes: { action: AuthorizationAction; title: string; description: (label: AgentClient['label']) => string }[] = [
  {
    action: 'read_context',
    title: 'Read bounded context',
    description: (label) => `${label} may read bounded immutable raw self-reports and confirmed outcomes when you ask it to help. Each MCP request has a record limit.`,
  },
  {
    action: 'write_proposed_plan',
    title: 'Write proposed plans',
    description: (label) => `${label} may save a plan proposal for you to review. It only makes proposals and cannot confirm outcomes.`,
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

function authorizationKey(agentId: AgentClient['id'], action: AuthorizationAction) {
  return `${agentId}:${action}`;
}

export function PlansView({ client = getSupabaseClient() }: { client?: SupabaseClient }) {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [authorizations, setAuthorizations] = useState<AuthorizationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingAuthorizations, setPendingAuthorizations] = useState<Set<string>>(new Set());
  const pendingAuthorizationKeys = useRef(new Set<string>());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [plansResult, authorizationsResult] = await Promise.all([
        client.from('plans').select('id, raw_plan_text, plan_data, provenance, status, source_client, created_at').is('deleted_at', null).order('created_at', { ascending: false }),
        client.from('agent_authorizations').select('id, agent_identifier, action, granted_at, revoked_at').order('granted_at', { ascending: false }),
      ]);
      setPlans(requireResult(plansResult, 'load proposed plans') as PlanRow[]);
      setAuthorizations(requireResult(authorizationsResult, 'load agent permissions') as AuthorizationRow[]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'AGym could not load plans and permissions.');
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  function activeAuthorization(agentId: AgentClient['id'], action: AuthorizationAction) {
    return authorizations.find((authorization) => authorization.agent_identifier === agentId && authorization.action === action && authorization.revoked_at === null);
  }

  function startAuthorizationMutation(key: string) {
    if (pendingAuthorizationKeys.current.has(key)) return false;
    pendingAuthorizationKeys.current.add(key);
    setPendingAuthorizations((current) => new Set(current).add(key));
    return true;
  }

  function finishAuthorizationMutation(key: string) {
    pendingAuthorizationKeys.current.delete(key);
    setPendingAuthorizations((current) => {
      const next = new Set(current);
      next.delete(key);
      return next;
    });
  }

  async function grant(agent: AgentClient, action: AuthorizationAction) {
    const key = authorizationKey(agent.id, action);
    if (!startAuthorizationMutation(key)) return;
    setMessage(null);
    try {
      const { data, error } = await client.auth.getUser();
      if (error || !data.user) {
        setMessage(`AGym could not verify your signed-in account: ${error?.message ?? 'no active user.'}`);
        return;
      }
      const result = await client.from('agent_authorizations').insert({
        user_id: data.user.id,
        agent_identifier: agent.id,
        action,
        scope: { version: 1 },
      });
      if (result.error) {
        if (result.error.code === '23505' || /duplicate|unique/i.test(result.error.message)) {
          setMessage(`${agent.label} already has this permission active. Refresh the permission state before trying again.`);
        } else {
          setMessage(`AGym could not grant ${agent.label} permission: ${result.error.message}`);
        }
        return;
      }
      setMessage(`${agent.label} permission granted. It takes effect on the next MCP call.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? `AGym could not grant ${agent.label} permission: ${error.message}` : `AGym could not grant ${agent.label} permission.`);
    } finally {
      finishAuthorizationMutation(key);
    }
  }

  async function revoke(agent: AgentClient, authorization: AuthorizationRow) {
    const key = authorizationKey(agent.id, authorization.action);
    if (!startAuthorizationMutation(key)) return;
    setMessage(null);
    try {
      const result = await client.from('agent_authorizations')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', authorization.id)
        .is('revoked_at', null)
        .select('id');
      if (result.error) {
        setMessage(`AGym could not revoke ${agent.label} permission: ${result.error.message}`);
        return;
      }
      if (!Array.isArray(result.data) || result.data.length === 0) {
        setMessage(`${agent.label} permission was already revoked or changed. Refresh the permission state.`);
        await load();
        return;
      }
      setMessage(`${agent.label} permission revoked. Future MCP calls using this scope will be denied.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? `AGym could not revoke ${agent.label} permission: ${error.message}` : `AGym could not revoke ${agent.label} permission.`);
    } finally {
      finishAuthorizationMutation(key);
    }
  }

  return (
    <section className="panel" aria-labelledby="plans-heading">
      <h2 id="plans-heading">Plans & agent access</h2>
      <p className="warning">Plans are agent-authored proposals, not confirmed outcomes, medical advice, or automatically active instructions.</p>

      {agentClients.map((agent) => (
        <section aria-labelledby={`${agent.id}-access-heading`} key={agent.id}>
          <h3 id={`${agent.id}-access-heading`}>{agent.label} permissions</h3>
          <p className="microcopy">Each permission is separate and revocable. AGym keeps the grant/revocation record under your account.</p>
          {scopes.map((scope) => {
            const authorization = activeAuthorization(agent.id, scope.action);
            const isPending = pendingAuthorizations.has(authorizationKey(agent.id, scope.action));
            return (
              <article className="authorization-card" key={scope.action}>
                <div><h4>{scope.title}</h4><p>{scope.description(agent.label)}</p></div>
                {authorization
                  ? <button className="danger" disabled={isPending} onClick={() => void revoke(agent, authorization)}>Revoke {agent.label} permission to {scope.title.toLowerCase()}</button>
                  : <button className="primary" disabled={isPending} onClick={() => void grant(agent, scope.action)}>Allow {agent.label} to {scope.title.toLowerCase()}</button>}
              </article>
            );
          })}
        </section>
      ))}

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
