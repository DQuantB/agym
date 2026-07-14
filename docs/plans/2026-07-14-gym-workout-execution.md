# Gym Workout Execution Page Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Add a dedicated, durable Gym Workout page where an agent-scheduled structured workout automatically appears for its date, the user edits actual training as it happens, uses a rest timer, adds notes, and finishes into a linked user-confirmed outcome.

**Architecture:** Keep the `plans` row immutable as an agent-authored proposal. Add a date-indexed schedule field and a Gym-specific `workout_executions` table for the user-owned, editable in-progress session. A single authenticated database RPC will complete an execution atomically by creating an immutable raw execution record and a user-confirmed canonical workout event linked to the originating plan. The new page talks directly to the narrow hosted data model; the old Log/Timeline/Plans pages remain unchanged.

**Tech Stack:** Vite + React + TypeScript, Zod, Supabase Auth/Postgres/RLS, MCP SDK, Vitest.

**Non-goals:** Calendar month view, editing/deleting agent plans, automatic plan activation/acceptance, changing the generic logging UI, server-side LLM parsing, running/meals, medical recommendations, autonomous completion.

---

## Product contract

### Incoming Gym plan (`plan_data`)

```ts
{
  kind: 'gym_workout',
  schema_version: 1,
  scheduled_for: 'YYYY-MM-DD',
  title: 'Lower strength',
  exercises: [{
    client_id: 'squat',
    name: 'Back squat',
    sets: [{ reps: 5, weight_kg: 60, rest_seconds: 180 }]
  }],
  notes: 'Optional agent rationale or user-facing notes.'
}
```

An agent-created Gym plan is immediately visible on its `scheduled_for` date, but
must always render as an `agent-written proposal`. Existing legacy/free-text plans
stay visible in Plans and are not converted or shown as a Workout.

### Execution contract

`workout_executions` preserves:
- `planned_snapshot`: immutable Gym plan snapshot at first start;
- `execution_data`: editable actual exercises/sets, including user-added rows;
- `additional_notes`: verbatim user-entered self-report;
- `status`: `in_progress` or `completed`.

Completion does not update `plans`. It atomically writes a raw execution transcript
plus a `canonical_events` row with `provenance: user_confirmed` and `plan_id`.

## Task 1: Database schedule + durable execution boundary

**Files:**
- Create: `supabase/migrations/<timestamp>_add_gym_workout_executions.sql`
- Create: `supabase/tests/gym-workout-execution.sql`

1. Add nullable `plans.scheduled_for date` and an owner/date index.
2. Add `workout_execution_status` enum and `workout_executions` with owner-scoped
   FKs, date, immutable planned snapshot, editable actual JSON, notes, timestamps,
   and one active execution per plan/date.
3. Enable RLS. Owners may read/insert/update only their own in-progress execution;
   browser may not delete completed records or change owner/plan/planned snapshot.
4. Create authenticated `complete_gym_workout_execution(p_execution_id uuid)` RPC.
   It derives identity from `auth.uid()`, locks the execution, creates an immutable
   raw log and linked canonical event, marks the execution complete, and rejects
   repeated/cross-user completion. Revoke default execute; grant authenticated only.
5. Add a plain SQL test proving owner lifecycle, cross-user denial, idempotence, and
   canonical/raw/plan linkage. Run it locally after `supabase db reset`.

## Task 2: Typed Gym plan + execution client module

**Files:**
- Create: `src/workout/gymSchemas.ts`
- Create: `src/workout/workoutApi.ts`
- Create: `src/workout/gymSchemas.test.ts`
- Create: `src/workout/workoutApi.test.ts`

1. Define Zod schemas/types for Gym plan data, editable exercise/set execution data,
   and execution rows. Keep weight optional/null and never infer RPE or health data.
2. Provide date helper using browser-local `YYYY-MM-DD`.
3. Implement data functions: load plan for date, load/start in-progress execution,
   save execution edits, complete execution through the RPC.
4. Every user-write includes authenticated user identity where required; never send
   provenance/status/owner values that the server must control.
5. Test valid/invalid plan parsing, user-added exercise/set shape, and Supabase query
   shapes/error handling with mocked client calls.

## Task 3: Validate and schedule new Gym MCP plans

**Files:**
- Modify: `mcp/agym-server.ts`
- Create/Modify: `mcp/*.test.ts` or existing MCP verification harness
- Create: `supabase/migrations/<timestamp>_schedule_mcp_gym_plans.sql` only if Task 1
  does not safely set `scheduled_for` from `plan_data` in the existing RPC.

1. Add a Zod discriminated Gym-plan schema to `create_proposed_plan` while retaining
   compatibility for existing generic/legacy agent proposals.
2. Validate required formatted Gym fields, bounded counts, nonblank exercise names,
   positive reps/weights/rest where provided, and a calendar date.
3. Store the Gym plan date in `plans.scheduled_for` inside the server-side creation
   RPC; default legacy plans to the server’s current date only when no date exists.
4. Ensure MCP continues to control `provenance: agent_written_plan` and
   `status: proposed`; the caller cannot make a plan active or complete an execution.
5. Update smoke/E2E coverage for a valid structured Gym plan and invalid payload
   rejection.

## Task 4: Workout page components and rest timer

**Files:**
- Create: `src/components/WorkoutView.tsx`
- Create: `src/components/RestTimer.tsx`
- Create: `src/components/WorkoutView.test.tsx`
- Create: `src/components/RestTimer.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/domain/types.ts`
- Modify: `src/app.css`

1. Add `workout` tab first in the app navigation. It shows Today’s date and plan.
2. Empty state: clearly say no scheduled structured Gym workout, link the user to
   Plans, and do not fabricate a workout from free-text plans.
3. When a plan exists, show an Agent proposal baseline plus editable actual rows.
   Render exercise, each set’s reps/load, add-set and add-exercise buttons, and a
   remove action for user-added rows only.
4. A set’s “completed” control starts/restarts the rest timer using the set’s planned
   rest seconds; timer supports pause, reset, and accessible countdown text.
5. Persist each edit (debounced or explicit Save progress control); restore an
   in-progress execution on reload.
6. Add `Additional notes` and a deliberate `Finish workout` action. On success,
   show completed state and prevent edits/completing twice.
7. Test display, editable values, adding rows, timer behavior with fake timers,
   persistence calls, completion, error states, and non-editable completed state.

## Task 5: End-to-end validation and delivery

**Files:**
- Modify: `docs/architecture/networked-alpha-verification.md`
- Modify: `docs/deploy/going-live.md` if it has relevant founder-proof steps

1. Reset local Supabase; run existing RLS tests and the new SQL lifecycle test.
2. Run MCP smoke/E2E and focused UI tests, then lint/typecheck/build/full Vitest suite.
3. Apply migrations to hosted only after all local tests pass; verify migration parity.
4. Run hosted founder proof: MCP Gym plan → Workout page auto-appears → edit values,
   add exercise, use timer → finish → verify linked raw/canonical outcome and audit.
5. Commit small logical units, open PR, wait for CI, and deploy only after review.
