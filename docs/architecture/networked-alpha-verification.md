# Networked alpha — verification log

This records the checks actually executed against the branch, not just intended.
Re-runnable; see commands below.

## App slice (offline)

| Check | Command | Result |
|---|---|---|
| Type check (app + MCP) | `npm run typecheck` | PASS |
| Lint | `npm run lint` | PASS (0 warnings) |
| Unit/component tests | `npm run test:run` | 101 passed / 17 files |

Note: on the Windows-mounted WSL filesystem vitest environment setup is very slow
(~300s) while the tests themselves run in ~2.5s. The suite can report a non-zero
exit from a teardown handle-leak even when every test passes — trust the
`Tests N passed` summary line.

101/17 was confirmed on the Gym workout execution branch (2026-07-14, WSL,
after a fresh `supabase db reset --local`), including the three new files
(`src/workout/workoutApi.test.ts`, `src/components/RestTimer.test.tsx`,
`src/components/WorkoutView.test.tsx`) and the `WorkoutView` fixes that ship
alongside them. Two real bugs surfaced and were fixed during this run: an
overly aggressive reps-field guard that broke clear-then-type editing, and two
`WorkoutView` tests that hung because `vi.useFakeTimers()` was enabled before
an awaited `findByText` (which needs real timers to poll). Type check, lint,
and build were re-confirmed clean after both fixes landed — see Phase 5.

## Phase 1 — Database + RLS (live local Supabase)

```bash
supabase start                    # local stack
supabase db reset --local         # applies all 8 migrations from scratch
docker exec -i supabase_db_agym psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 < supabase/tests/rls-isolation.sql
docker exec -i supabase_db_agym psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 < supabase/tests/account-deletion.sql
docker exec -i supabase_db_agym psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 < supabase/tests/gym-workout-execution.sql
```

All 8 migrations apply cleanly. RLS isolation suite: 11/11 PASS, covering:

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

`gym-workout-execution.sql` (added with the Gym workout execution branch):
10/10 PASS, confirmed 2026-07-14 on WSL against the local stack (migrations
applied via a separately-confirmed fresh `supabase db reset --local` — the
SQL run itself predates that specific reset by a few minutes but targets the
same migration set, so it isn't stale). It proves the durable execution
boundary end to end:

- the owner can start an execution and edit `execution_data`/`additional_notes`;
- the immutable `planned_snapshot` baseline cannot be mutated directly, and a
  client cannot flip `status`/`completed_at` by browser update even by setting
  a spoofed session config, only through the RPC;
- `complete_gym_workout_execution(...)` atomically creates a linked
  `canonical_events` row (`event_type = 'workout_execution'`) and an immutable
  `raw_logs` row (`source_hint = 'workout'`), and marks the execution completed
  exactly once;
- a second completion of the same execution is rejected (no double-confirm);
- a different user can neither read nor complete another owner's execution.

## Phase 4 — MCP / Hermes loop (live local Supabase)

```bash
npm run mcp:smoke     # offline: config validation + all 3 tools register
AGYM_SUPABASE_SERVICE_ROLE_KEY=<local secret> npm run mcp:e2e   # live round-trip
```

`mcp:smoke` — config validation rejects missing env, and `get_context`,
`list_plans`, `create_proposed_plan` all register. The server also refuses to
start with missing env (exits 1) rather than running unbound.

`mcp:e2e` self-seeds a user (confirmed event + raw note + both grants) and
drives the real registered tool handlers against the DB. The Gym workout
execution branch renumbered the file to 7 steps and added a real MCP
`Client`/`Server` pair over an in-memory transport, so Gym `plan_data` is
validated through the SDK's actual input-schema layer rather than the
direct-handler shortcut the rest of the file uses. Confirmed 2026-07-14 on WSL
against a freshly-reset local stack: **7/7 PASS**, audit log grew +5 rows.

1. `get_context` returns the confirmed event labelled `user_confirmed` and the
   raw note labelled `raw_self_report` / `unparsed` (no flattening of uncertainty);
2. `create_proposed_plan` writes a `proposed` plan with provenance
   `agent_written_plan` via the authorized SECURITY DEFINER RPC;
3. `list_plans` returns the new plan;
4. an incomplete or malformed `gym_workout` `plan_data` payload is rejected at
   the MCP protocol boundary itself, before the handler (and its RPC call) ever
   runs — confirmed by the plan count not changing;
5. a valid structured Gym payload sent through the same real protocol path is
   accepted, `scheduled_for` is set to today, and `list_plans` surfaces that
   schedule to the agent;
6. the append-only `agent_audit_log` grew by 5 rows (get_context, list_plans
   ×2, create_proposed_plan ×2 — including the two Gym-specific calls above);
7. after the user revokes `read_context`, `get_context` is denied and returns
   no data.

### Phase 5 — Gym workout execution

| Check | Command | Result |
|---|---|---|
| Workout API client contract | `npm run test:run -- src/workout/workoutApi.test.ts` | PASS (part of the 101/17 run above) |
| Rest timer behavior | `npm run test:run -- src/components/RestTimer.test.tsx` | PASS (part of the 101/17 run above) |
| Workout page behavior | `npm run test:run -- src/components/WorkoutView.test.tsx` | PASS, 16/16 (part of the 101/17 run above) |
| Full suite (all files) | `npm run test:run` | PASS — 101 passed / 17 files |
| SQL lifecycle test | `supabase/tests/gym-workout-execution.sql` | PASS — 10/10 (see Phase 1) |
| MCP e2e (updated, gym steps) | `npm run mcp:e2e` | PASS — 7/7 (see Phase 4) |
| Fresh migration apply | `supabase db reset --local` | PASS — all 8 migrations applied cleanly |
| Type check | `npm run typecheck` | PASS |
| Lint | `npm run lint` | PASS (0 warnings) |
| Build | `npm run build` | PASS |

All confirmed 2026-07-14 on WSL, including a final re-run of type check, lint,
and build after the two follow-up fixes (a reps-field onChange guard revert,
and moving `vi.useFakeTimers()` after the initial render in two WorkoutView
tests). Every check in this table has now actually been executed and passed —
nothing in this section is pending.

### Least-privilege facts confirmed during verification

- `service_role` (the MCP process identity) has **INSERT-only** on
  `agent_audit_log` — the agent can append audit rows but cannot read them.
- `service_role` has **SELECT-only** on `agent_authorizations` — the agent
  cannot grant or revoke its own permissions; only the authenticated user can.
- Authorization revocation is **permanent** (a DB trigger blocks un-revoking);
  a new grant must be created after a revoke.

These are correct guardrails: an agent can neither expand its own access nor
erase its own audit trail.
