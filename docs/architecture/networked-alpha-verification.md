# Networked alpha — verification log

This records the checks actually executed against the branch, not just intended.
Re-runnable; see commands below.

## App slice (offline)

| Check | Command | Result |
|---|---|---|
| Type check (app + MCP) | `npm run typecheck` | PASS |
| Lint | `npm run lint` | PASS (0 warnings) |
| Unit/component tests | `npm run test:run` | 57 passed / 12 files |

Note: on the Windows-mounted WSL filesystem vitest environment setup is very slow
(~300s) while the tests themselves run in ~2.5s. The suite can report a non-zero
exit from a teardown handle-leak even when every test passes — trust the
`Tests N passed` summary line.

## Phase 1 — Database + RLS (live local Supabase)

```bash
supabase start                    # local stack
supabase db reset --local         # applies all 5 migrations from scratch
docker exec -i supabase_db_agym psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 < supabase/tests/rls-isolation.sql
```

All 5 migrations apply cleanly. RLS isolation suite: 11/11 PASS, covering:

- auth trigger creates exactly the two profiles;
- owner reads own raw log;
- raw-log delete rejected (raw evidence immutable from the browser);
- duplicate active authorization rejected (one active grant per action);
- browser role cannot execute the SECURITY DEFINER MCP plan RPC;
- tenant isolation hides another user's raw log and profile;
- cross-user raw-log insert rejected by RLS WITH CHECK;
- browser parse-draft insert rejected;
- browser plan insert rejected;
- no cross-user row was created.

## Phase 4 — MCP / Hermes loop (live local Supabase)

```bash
npm run mcp:smoke     # offline: config validation + all 3 tools register
AGYM_SUPABASE_SERVICE_ROLE_KEY=<local secret> npm run mcp:e2e   # live round-trip
```

`mcp:smoke` — config validation rejects missing env, and `get_context`,
`list_plans`, `create_proposed_plan` all register. The server also refuses to
start with missing env (exits 1) rather than running unbound.

`mcp:e2e` self-seeds a user (confirmed event + raw note + both grants) and
drives the real registered tool handlers against the DB. 5/5 PASS:

1. `get_context` returns the confirmed event labelled `user_confirmed` and the
   raw note labelled `raw_self_report` / `unparsed` (no flattening of uncertainty);
2. `create_proposed_plan` writes a `proposed` plan with provenance
   `agent_written_plan` via the authorized SECURITY DEFINER RPC;
3. `list_plans` returns the new plan;
4. the append-only `agent_audit_log` grew by 3 rows (one per MCP action);
5. after the user revokes `read_context`, `get_context` is denied and returns
   no data.

### Least-privilege facts confirmed during verification

- `service_role` (the MCP process identity) has **INSERT-only** on
  `agent_audit_log` — the agent can append audit rows but cannot read them.
- `service_role` has **SELECT-only** on `agent_authorizations` — the agent
  cannot grant or revoke its own permissions; only the authenticated user can.
- Authorization revocation is **permanent** (a DB trigger blocks un-revoking);
  a new grant must be created after a revoke.

These are correct guardrails: an agent can neither expand its own access nor
erase its own audit trail.
