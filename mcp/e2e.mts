// End-to-end MCP round-trip against the LIVE local Supabase DB.
// Drives the real registered tool callbacks (not reimplemented logic) for
// most steps; the Gym plan_data validation steps additionally go through a
// real MCP Client/Server pair so the SDK's inputSchema (Zod) parsing layer
// is actually exercised, not bypassed.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
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

// Build a real MCP server for each named client and invoke its registered tool
// callback. This exercises the production authorization lookup rather than a
// test double, while keeping client isolation assertions independent.
async function callAs(agentIdentifier: string, name: string, args: Record<string, unknown>) {
  const namedServer = createAgymMcpServer(client, { ...cfg, agentIdentifier });
  const namedTools = (namedServer as unknown as { _registeredTools: Record<string, { handler: (toolArgs: unknown, extra: unknown) => Promise<{ content: { type: string; text: string }[]; isError?: boolean }> }> })._registeredTools;
  const res = await namedTools[name].handler(args, {} as unknown);
  const text = res.content.map((content) => content.text).join('\n');
  return { isError: !!res.isError, text, json: (() => { try { return JSON.parse(text); } catch { return null; } })() };
}

// Real client/server pair over an in-memory transport, so calls below go
// through the SDK's CallTool request handler -- including the Zod
// safeParseAsync validation of each tool's inputSchema -- instead of
// invoking the raw registered handler directly like `call()` does above.
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
const mcpClient = new Client({ name: 'agym-e2e-client', version: '0.0.0' });
await Promise.all([mcpClient.connect(clientTransport), server.connect(serverTransport)]);

async function callProtocol(name: string, args: Record<string, unknown>) {
  const res = (await mcpClient.callTool({ name, arguments: args })) as { content: { type: string; text: string }[]; isError?: boolean };
  const text = res.content.map((c) => c.text).join('\n');
  return { isError: !!res.isError, text, json: (() => { try { return JSON.parse(text); } catch { return null; } })() };
}

function planCount(): number {
  const out = execSync(
    `docker exec -i supabase_db_agym psql -U postgres -d postgres -tA -c "select count(*) from public.plans where user_id='${USER_ID}';"`,
  ).toString().trim();
  return Number(out);
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
const created = await call('create_proposed_plan', { raw_plan_text: 'Next session: bench 3x5 @ 82.5kg', plan_data: { kind: 'gym_workout', schema_version: 1, scheduled_for: new Date().toISOString().slice(0, 10), title: 'Bench strength', exercises: [{ client_id: 'bench', name: 'Bench press', sets: [{ reps: 5, weight_kg: 82.5, rest_seconds: 180 }] }] } });
assert.equal(created.isError, false, `create_proposed_plan errored: ${created.text}`);
assert.equal(created.json.plan.status, 'proposed', 'plan should be proposed');
assert.equal(created.json.plan.provenance, 'agent_written_plan', 'plan provenance must be agent_written_plan');
console.log('2) create_proposed_plan OK: status=proposed, provenance=agent_written_plan');

// 3) list_plans returns the new plan.
const plans = await call('list_plans', { limit: 20 });
assert.equal(plans.isError, false, `list_plans errored: ${plans.text}`);
assert.ok(plans.json.plans.length >= 1, 'expected at least 1 plan');
console.log(`3) list_plans OK: ${plans.json.plans.length} plan(s)`);

// 4) Protocol-level validation: invalid Gym payloads are rejected at the MCP
//    inputSchema boundary itself, before the handler (and its RPC call) ever
//    runs -- so no plan row is created for either case.
const plansBefore = planCount();

const missingFields = await callProtocol('create_proposed_plan', { raw_plan_text: 'Missing required gym fields', plan_data: { kind: 'gym_workout', schema_version: 1 } });
assert.equal(missingFields.isError, true, 'incomplete gym_workout payload must be rejected');

const malformedGym = await callProtocol('create_proposed_plan', { raw_plan_text: 'Malformed gym shape', plan_data: { kind: 'gym_workout', foo: 1 } });
assert.equal(malformedGym.isError, true, 'gym_workout payload must use the formatted schema');

assert.equal(planCount(), plansBefore, 'invalid gym payloads must not create a plan row');
console.log('4) protocol-level gym validation OK: invalid payloads rejected before touching the DB');

// 5) A valid Gym payload, sent through the same real protocol path, is
// accepted and scheduled for today; list_plans then surfaces that schedule.
const today = new Date().toISOString().slice(0, 10);
const validGym = await callProtocol('create_proposed_plan', {
  raw_plan_text: 'Protocol-validated squat day',
  plan_data: { kind: 'gym_workout', schema_version: 1, scheduled_for: today, title: 'Squat day', exercises: [{ client_id: 'squat', name: 'Back squat', alternatives: [{ client_id: 'front-squat', name: 'Front squat' }], sets: [{ reps: 5, weight_kg: 100, rest_seconds: 180 }] }] },
});
assert.equal(validGym.isError, false, `valid gym plan rejected: ${validGym.text}`);
assert.equal(validGym.json.plan.scheduled_for, today, 'gym plan must be scheduled for today');
assert.deepEqual(
  validGym.json.plan.plan_data.exercises[0].alternatives,
  [{ client_id: 'front-squat', name: 'Front squat' }],
  'exercise alternatives must survive the MCP schema and RPC round trip',
);

const plansWithSchedule = await call('list_plans', { limit: 20 });
assert.equal(plansWithSchedule.isError, false, `list_plans errored: ${plansWithSchedule.text}`);
const scheduledPlan = plansWithSchedule.json.plans.find((p: { id: string }) => p.id === validGym.json.plan.id);
assert.ok(scheduledPlan, 'expected the newly created gym plan in list_plans');
assert.equal(scheduledPlan.scheduled_for, today, 'list_plans must expose scheduled_for so agents can see the schedule');
assert.deepEqual(
  scheduledPlan.plan_data.exercises[0].alternatives,
  [{ client_id: 'front-squat', name: 'Front squat' }],
  'exercise alternatives must also round-trip through list_plans',
);
console.log('5) valid gym plan OK: scheduled_for=today, alternatives round-trip, and visible via list_plans');

// 5b) validGym is the second gym plan scheduled for today (after step 2's
// "Bench strength" plan): its advisory conflict must be notice-tier only --
// same-day duplicate proposals are the routine "ask for changes" loop, not a
// warning -- and must reference the first plan.
assert.equal(validGym.json.conflicts.checked, true, 'conflict check should run for a scheduled gym plan');
assert.equal(validGym.json.conflicts.severity, 'notice', 'a second same-day gym plan should be a routine revision, not a warning');
assert.ok(validGym.json.conflicts.reasons.includes('duplicate_proposal'), 'expected duplicate_proposal reason');
assert.ok(validGym.json.conflicts.plans.some((p: { id: string }) => p.id === created.json.plan.id), 'conflicting plan should reference the first proposal');
console.log('5b) conflict advisory OK: severity=notice for a same-day duplicate proposal');

// 6) Audit log grew (get_context + list_plans x2 + create_proposed_plan RPC x2).
const grew = auditCount() - before;
assert.ok(grew >= 3, `expected >=3 new audit rows, got ${grew}`);
console.log(`6) audit log OK: +${grew} rows since baseline`);

// 7) Advisory conflicts escalate to "warning" once one of today's plans is
// accepted (active), and further to named amplifiers once that active plan
// is user-revised and already has a linked execution -- but creation is
// never blocked either way.
psql(`update public.plans set status = 'active' where id = '${created.json.plan.id}';`);
const plansBeforeWarning = planCount();
const warningProposal = await call('create_proposed_plan', {
  raw_plan_text: 'Third same-day proposal',
  plan_data: { kind: 'gym_workout', schema_version: 1, scheduled_for: today, title: 'Third session', exercises: [{ client_id: 'row', name: 'Barbell row', sets: [{ reps: 8, weight_kg: 60, rest_seconds: 90 }] }] },
});
assert.equal(warningProposal.isError, false, `warning-tier create_proposed_plan errored: ${warningProposal.text}`);
assert.equal(warningProposal.json.conflicts.severity, 'warning', 'an accepted same-day plan must escalate to warning');
assert.ok(warningProposal.json.conflicts.reasons.includes('active_plan_accepted'), 'expected active_plan_accepted reason');
assert.equal(warningProposal.json.conflicts.counts.active, 1, 'expected exactly one competing active plan');
assert.equal(warningProposal.json.plan.status, 'proposed', 'the new plan itself must still be created as proposed');
assert.equal(planCount(), plansBeforeWarning + 1, 'a warning-tier conflict must not block plan creation');
console.log('7a) conflict advisory OK: accepting a same-day plan escalates a later proposal to severity=warning, still non-blocking');

psql(`
  update public.plans set user_revision_data = '{"kind":"gym_workout","schema_version":1,"scheduled_for":"${today}","title":"Hand-revised","exercises":[]}'::jsonb, user_revision_updated_at = now()
  where id = '${created.json.plan.id}';
  insert into public.workout_executions (user_id, plan_id, scheduled_for, planned_snapshot, status, completed_at)
  values ('${USER_ID}', '${created.json.plan.id}', '${today}', '{}'::jsonb, 'completed', now());
`);
const amplifiedProposal = await call('create_proposed_plan', { raw_plan_text: 'Fourth same-day proposal', plan_data: { kind: 'gym_workout', schema_version: 1, scheduled_for: today, title: 'Fourth session', exercises: [{ client_id: 'row', name: 'Barbell row', sets: [{ reps: 8, weight_kg: 62.5, rest_seconds: 90 }] }] } });
assert.equal(amplifiedProposal.isError, false, `amplified create_proposed_plan errored: ${amplifiedProposal.text}`);
assert.ok(amplifiedProposal.json.conflicts.reasons.includes('active_plan_user_revised'), 'expected active_plan_user_revised reason');
assert.ok(amplifiedProposal.json.conflicts.reasons.includes('active_plan_has_execution'), 'expected active_plan_has_execution reason');
console.log('7b) conflict advisory OK: a hand-revised, already-executed active plan surfaces both amplifier reasons');

const nonGymProposal = await call('create_proposed_plan', { raw_plan_text: 'Non-gym proposal for conflict test' });
assert.equal(nonGymProposal.isError, false, `non-gym create_proposed_plan errored: ${nonGymProposal.text}`);
assert.equal(nonGymProposal.json.conflicts.checked, false, 'a non-gym plan must skip the conflict check entirely');
assert.equal(nonGymProposal.json.conflicts.severity, 'none');
console.log('7c) conflict advisory OK: a non-gym plan skips the conflict check without erroring');

// 8) Authorization gate: user revokes read_context -> get_context must fail with no data.
// Revoke via privileged psql: the MCP service_role deliberately cannot mutate its own grants.
psql(`update public.agent_authorizations set revoked_at = now() where user_id='${USER_ID}' and action='read_context';`);
const denied = await call('get_context', { limit: 5 });
assert.equal(denied.isError, true, 'get_context must fail after revocation');
assert.match(denied.text, /No active read_context authorization/);
console.log('8) authz gate OK: revoked read_context -> get_context denied, no data returned');
// Note: revocation is permanent (DB trigger blocks un-revoke); the seed recreates the user each run.

// 9) Named-client grants are exact: Claude Code has no authority until the
// user separately grants each action. Codex remains denied at this point too.
const claudeReadDenied = await callAs('claude-code', 'get_context', { limit: 1, include_raw_notes: false });
assert.equal(claudeReadDenied.isError, true, 'Claude Code must not inherit Hermes read access');
assert.match(claudeReadDenied.text, /No active read_context authorization/);
const claudeWriteDenied = await callAs('claude-code', 'create_proposed_plan', { raw_plan_text: 'Named-client proposal' });
assert.equal(claudeWriteDenied.isError, true, 'Claude Code must not write without its own grant');

const codexReadDenied = await callAs('codex', 'get_context', { limit: 1, include_raw_notes: false });
assert.equal(codexReadDenied.isError, true, 'Codex must not inherit another client\'s read access');
const codexWriteDenied = await callAs('codex', 'create_proposed_plan', { raw_plan_text: 'Named-client proposal' });
assert.equal(codexWriteDenied.isError, true, 'Codex must not write without its own grant');
console.log('9) named clients denied until each has its own grant');

// Grants and revocations are owner-only database operations; the service-role
// MCP client intentionally cannot grant itself access.
psql(`
  insert into public.agent_authorizations (user_id, agent_identifier, action)
  values ('${USER_ID}', 'claude-code', 'read_context'), ('${USER_ID}', 'claude-code', 'write_proposed_plan');
`);
const claudeReadAllowed = await callAs('claude-code', 'get_context', { limit: 1, include_raw_notes: false });
assert.equal(claudeReadAllowed.isError, false, 'Claude Code read grant should permit only Claude Code');
const claudeWriteAllowed = await callAs('claude-code', 'create_proposed_plan', { raw_plan_text: 'Named-client proposal' });
assert.equal(claudeWriteAllowed.isError, false, 'Claude Code write grant should permit proposal creation');
console.log('10) Claude Code allowed only after its own read/write grants');

// Codex remains denied until its separate grants exist, then continues to work
// after Claude Code's read authorization is revoked.
const codexStillDenied = await callAs('codex', 'get_context', { limit: 1, include_raw_notes: false });
assert.equal(codexStillDenied.isError, true, 'Codex must remain denied before its separate read grant');
psql(`
  insert into public.agent_authorizations (user_id, agent_identifier, action)
  values ('${USER_ID}', 'codex', 'read_context'), ('${USER_ID}', 'codex', 'write_proposed_plan');
`);
const codexReadAllowed = await callAs('codex', 'get_context', { limit: 1, include_raw_notes: false });
assert.equal(codexReadAllowed.isError, false, 'Codex read grant should permit Codex');
const codexWriteAllowed = await callAs('codex', 'create_proposed_plan', { raw_plan_text: 'Named-client proposal' });
assert.equal(codexWriteAllowed.isError, false, 'Codex write grant should permit Codex');

psql(`update public.agent_authorizations set revoked_at = now() where user_id='${USER_ID}' and agent_identifier='claude-code' and action='read_context';`);
const claudeRevoked = await callAs('claude-code', 'get_context', { limit: 1, include_raw_notes: false });
assert.equal(claudeRevoked.isError, true, 'revoked Claude Code read grant must deny Claude Code');
const codexUnaffected = await callAs('codex', 'get_context', { limit: 1, include_raw_notes: false });
assert.equal(codexUnaffected.isError, false, 'revoking Claude Code must not affect Codex');
console.log('11) named-client isolation OK: Claude Code revocation leaves Codex grants active');

console.log('\nMCP E2E round-trip: ALL PASS');
