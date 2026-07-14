// End-to-end MCP round-trip against the LIVE local Supabase DB.
// Drives the real registered tool callbacks (not reimplemented logic).
import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { createAgymMcpServer, type AgymMcpConfiguration } from './agym-server';

const URL = 'http://127.0.0.1:54321';
const SERVICE_ROLE = process.env.AGYM_SUPABASE_SERVICE_ROLE_KEY!;
const USER_ID = '00000000-0000-0000-0000-0000000000aa';

const client = createClient(URL, SERVICE_ROLE, { auth: { persistSession: false, autoRefreshToken: false } });
const cfg: AgymMcpConfiguration = { supabaseUrl: URL, serviceRoleKey: SERVICE_ROLE, userId: USER_ID, agentIdentifier: 'hermes' };

function psql(sql: string) {
  execSync(`docker exec -i supabase_db_agym psql -U postgres -d postgres -v ON_ERROR_STOP=1`, { input: sql, stdio: ['pipe', 'ignore', 'inherit'] });
}

// Self-seed a clean fixture: one user with a confirmed event, a raw note, and both grants.
psql(`delete from auth.users where id='${USER_ID}';`);
psql(`
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('${USER_ID}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e2e-owner@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());
  insert into public.raw_logs (user_id, client_id, raw_text, logged_for_date)
  values ('${USER_ID}', 'raw_e2e_1', 'bench press 3x5 @ 80kg, felt strong', current_date);
  insert into public.canonical_events (user_id, client_id, source_raw_log_id, event_type, final_fields, confirmed_at)
  values ('${USER_ID}', 'evt_e2e_1', (select id from public.raw_logs where user_id='${USER_ID}' and client_id='raw_e2e_1'),
    'workout', '{"exercise":"bench press","sets":3,"reps":5,"weight_kg":80}'::jsonb, now());
  insert into public.agent_authorizations (user_id, agent_identifier, action)
  values ('${USER_ID}', 'hermes', 'read_context'), ('${USER_ID}', 'hermes', 'write_proposed_plan');
`);

const server = createAgymMcpServer(client, cfg);
const tools = (server as unknown as { _registeredTools: Record<string, { handler: (args: unknown, extra: unknown) => Promise<{ content: {type:string;text:string}[]; isError?: boolean }> }> })._registeredTools;

async function call(name: string, args: Record<string, unknown>) {
  const res = await tools[name].handler(args, {} as unknown);
  const text = res.content.map((c) => c.text).join('\n');
  return { isError: !!res.isError, text, json: (() => { try { return JSON.parse(text); } catch { return null; } })() };
}

// Baseline audit count (read via privileged psql: service_role has INSERT-only on audit log by design).
function auditCount(): number {
  const out = execSync(
    `docker exec -i supabase_db_agym psql -U postgres -d postgres -tA -c "select count(*) from public.agent_audit_log where user_id='${USER_ID}';"`,
  ).toString().trim();
  return Number(out);
}
const before = auditCount();

// 1) get_context returns the seeded confirmed event + raw note with correct provenance labels.
const ctx = await call('get_context', { limit: 14, include_raw_notes: true });
assert.equal(ctx.isError, false, `get_context errored: ${ctx.text}`);
assert.equal(ctx.json.confirmed_events.length, 1, 'expected 1 confirmed event');
assert.equal(ctx.json.confirmed_events[0].provenance, 'user_confirmed');
assert.equal(ctx.json.confirmed_events[0].data.exercise, 'bench press');
assert.equal(ctx.json.raw_notes.length, 1, 'expected 1 raw note');
assert.equal(ctx.json.raw_notes[0].provenance, 'raw_self_report');
assert.equal(ctx.json.raw_notes[0].interpretation_status, 'unparsed');
console.log('1) get_context OK: confirmed=user_confirmed, raw=raw_self_report/unparsed');

// 2) create_proposed_plan writes a proposed plan via authorized RPC.
const created = await call('create_proposed_plan', { raw_plan_text: 'Next session: bench 3x5 @ 82.5kg', plan_data: { progression_kg: 2.5 } });
assert.equal(created.isError, false, `create_proposed_plan errored: ${created.text}`);
assert.equal(created.json.plan.status, 'proposed', 'plan should be proposed');
assert.equal(created.json.plan.provenance, 'agent_written_plan', 'plan provenance must be agent_written_plan');
console.log('2) create_proposed_plan OK: status=proposed, provenance=agent_written_plan');

// 3) list_plans returns the new plan.
const plans = await call('list_plans', { limit: 20 });
assert.equal(plans.isError, false, `list_plans errored: ${plans.text}`);
assert.ok(plans.json.plans.length >= 1, 'expected at least 1 plan');
console.log(`3) list_plans OK: ${plans.json.plans.length} plan(s)`);

// 4) Audit log grew (get_context + list_plans + RPC's create_proposed_plan row).
const grew = auditCount() - before;
assert.ok(grew >= 3, `expected >=3 new audit rows, got ${grew}`);
console.log(`4) audit log OK: +${grew} rows since baseline`);

// 5) Authorization gate: user revokes read_context -> get_context must fail with no data.
// Revoke via privileged psql: the MCP service_role deliberately cannot mutate its own grants.
psql(`update public.agent_authorizations set revoked_at = now() where user_id='${USER_ID}' and action='read_context';`);
const denied = await call('get_context', { limit: 5 });
assert.equal(denied.isError, true, 'get_context must fail after revocation');
assert.match(denied.text, /No active read_context authorization/);
console.log('5) authz gate OK: revoked read_context -> get_context denied, no data returned');
// Note: revocation is permanent (DB trigger blocks un-revoke); the seed recreates the user each run.

console.log('\nMCP E2E round-trip: ALL PASS');
