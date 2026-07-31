# AGym Mobile v2 Delivery Plan

> **For Hermes:** use `subagent-driven-development` to implement one ticket at a time in a clean worktree. Run a specification-compliance review and a code-quality review before merging each ticket.

**Status:** proposed — planning artifact only; it does not authorize implementation, migration, deployment, or changes to connected-model permissions.

**Goal:** deliver a native, mobile-first AGym alpha whose user-visible loop is: an external LLM proposes a single scheduled workout → the user explicitly accepts it → the user logs the immutable plan versus actual training → the user confirms the outcome → AGym stores a linked canonical event and exposes only user-authorized context back to the LLM.

**Architecture:** retain the existing hosted Supabase/Auth/RLS/MCP trust boundary. Build `apps/mobile` as a standalone Expo + React Native client; do not move or rewrite the Vite web client. Reuse only Zod schemas and pure helpers after extraction into `packages/core`; never share web React components or CSS. Agent plans remain `proposed` until a user-controlled server transition accepts them. A completed execution remains a separate immutable, user-confirmed outcome linked to its accepted plan.

**Tech stack:** existing TypeScript, Supabase Auth/Postgres/RLS, MCP SDK, Zod, Vitest; new Expo + Expo Router + React Native + Expo SecureStore. Add a local durable draft/outbox only after the native execution screen exists.

**Authoritative inputs:**
- `docs/adr/0002-networked-agent-alpha.md` — hosted alpha and provenance boundary.
- `docs/plans/2026-07-21-mobile-alpha-feature-plan.md` — native-client strategy and later-phase research.
- `docs/plans/2026-07-14-gym-workout-execution.md` — existing plan/execution database boundary.
- `docs/design/APP-UI.md` — existing app UI tokens and raw/draft/canonical visual language.
- Founder-supplied `AGYM Mobile UI v2.png` — accepted interaction direction for Today, Workout, Calendar/Proposal review, Log, and Data.

**Scope rule:** the v2 board is a product direction, not permission to build every illustrated integration. In this first delivery sequence, a proposal is **one structured Gym workout on one scheduled date**. Multi-week plan bundles, per-session partial acceptance, native Strava/Apple Health import, voice capture, health-derived observations, and remote self-serve MCP are deferred.

---

## 1. Decisions locked before code

### 1.1 Mobile information architecture

Use the v2 bottom navigation, mapped to the actual alpha capabilities:

| v2 tab | Native alpha role | First-release contents |
| --- | --- | --- |
| Today | current state and next action | no-session, proposal waiting, ready, in-progress/draft, confirmed, sync-failed states |
| Calendar | scheduled plan and proposal review | agenda/week strip, one proposal banner, accept/dismiss for one Gym plan |
| Log | confirmed history and evidence | completed execution history; facts-only weekly summary with source-session drill-down |
| Data | sources and model permissions | current Hermes scopes, last known access/audit metadata when available, export/delete entry points |

Do not add a fifth Capture tab. Unstructured text capture remains a contextual action from Today or Log until the native text-capture ticket is separately authorized.

### 1.2 Provenance vocabulary

Use text plus icon plus placement; color is supplementary only.

| State | Required label | Meaning | Allowed action |
| --- | --- | --- | --- |
| Planned | `◇ Planned` | user-accepted future plan | start on its scheduled day |
| Agent proposal | `✧ Agent proposal · source · time` | agent-authored candidate; no schedule is active yet | review, dismiss |
| User confirmed | `✓ Confirmed · time` | user confirmed actual outcome | view evidence; later correction is a new revision |
| Imported | `↓ Imported · source · unreviewed` | external source record, not user-confirmed | review/ignore — deferred with imports |
| Observation | `≈ Observation` | derived, non-medical correlation | inspect evidence; no advice CTA |
| Local/sync state | `Saved locally`, `Syncing`, `Sync failed — retry` | durability/readability state | retry or continue locally |

Do not use the phrase “canonical event” as primary athlete-facing copy. It remains an internal/API term; use “confirmed session” in the UI.

### 1.3 Data-state correction required before native UI

The existing hosted Gym slice already preserves a `plans` row, an immutable `planned_snapshot`, an editable `workout_executions` draft, and a confirmed linked outcome. However, `WorkoutView` currently loads a scheduled Gym plan without filtering its `proposed` status. That is incompatible with the v2 rule “nothing applied yet.”

Before native reads are built:
- `proposed` plans must be visible only as proposals;
- only a user-accepted plan with status `active` may appear as the planned baseline/startable workout;
- the user must accept/dismiss through a narrowly scoped authenticated RPC, never by a browser update that can change provenance or arbitrary plan status;
- an accepted plan cannot mutate a completed execution; plan history/revert behavior is deferred until the single-session acceptance model is proven.

---

## 2. Delivery order and tickets

### Ticket M0 — Commit the mobile v2 product contract

**Objective:** make the founder-approved v2 interaction model durable and resolve the current proposal-versus-scheduled-plan contradiction before client work.

**Files:**
- Create: `docs/design/MOBILE-UI-v2.md`
- Modify: `docs/design/APP-UI.md`
- Modify: `docs/plans/2026-07-21-mobile-alpha-feature-plan.md`
- Test: no runtime test; docs review only

**Steps:**
1. Write `MOBILE-UI-v2.md` with the four-tab IA, status/provenance table, touch-target/contrast requirements, and v2 screen-to-alpha mapping.
2. State explicitly that the existing `APP-UI.md` governs web v1; its dark-first tokens are reusable, but its six web tabs do not prescribe native navigation.
3. Add the one-workout proposal acceptance limitation and the explicit deferrals to the mobile alpha plan.
4. Link the source image by filename/path; do not commit the image unless the founder explicitly asks to version binary design assets.
5. Review the documents against ADR 0002: no autonomous execution, no medical claims, no hidden model write.
6. Commit only documentation.

**Verification:**
```bash
git diff --check
git diff -- docs/design docs/plans
```
Expected: no whitespace errors; the UI spec clearly states that `proposed` is not a startable workout.

---

### Ticket M1 — Add a user-controlled single-workout plan acceptance boundary

**Objective:** enforce the v2 proposal lifecycle in the database and web proof surface before native clients consume it.

**Files:**
- Create: `supabase/migrations/<timestamp>_add_user_gym_plan_acceptance.sql`
- Create: `supabase/tests/gym-plan-acceptance.sql`
- Modify: `src/workout/workoutApi.ts`
- Modify: `src/workout/workoutApi.test.ts`
- Modify: `src/components/WorkoutView.tsx`
- Modify: `src/components/WorkoutView.test.tsx`
- Modify: `src/components/PlansView.tsx`
- Test: focused Vitest files and live SQL policy test

**Step 1: Write failing SQL lifecycle tests**

Cover these exact cases:
1. MCP-created Gym plan remains `proposed` and does not appear in the owner’s startable-workout query.
2. The owner can call an authenticated `accept_gym_plan(plan_id)` RPC only for their own valid Gym proposal.
3. Acceptance changes only the allowed plan’s status to `active`, records user-controlled acceptance metadata/audit data, and is idempotent or rejects repeat acceptance with a clear error — choose one behavior and document it.
4. The browser cannot update another user’s plan, self-set a plan to `active`, alter agent provenance, or accept a non-Gym/archived plan.
5. A completed workout execution stays linked to its original accepted plan and is not changed by later proposal operations.

**Step 2: Run the test before the migration**

```bash
supabase db reset --local
docker exec -i supabase_db_agym psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/gym-plan-acceptance.sql
```
Expected: failure because the acceptance RPC and policy boundary do not exist.

**Step 3: Implement the narrow migration**

- Add a `SECURITY DEFINER` authenticated RPC that derives `auth.uid()` and locks the target plan.
- Permit only `proposed → active` for a Gym plan owned by the caller.
- Preserve the original agent-written text/data/provenance and record the acceptance timestamp/actor in the smallest existing compatible audit surface; add a dedicated user action audit row only if the current audit schema cannot truthfully represent it.
- Revoke default execute from `PUBLIC`, `anon`, and `service_role`; grant only `authenticated`.
- Do not introduce a multi-week plan table, plan-item table, or generic workflow engine.

**Step 4: Update query contracts**

- Add separate APIs for `loadProposalForDate` and `loadAcceptedWorkoutForDate`.
- Make `loadWorkout` select `status = 'active'`; it must never create an execution from `proposed`.
- Add `acceptGymPlan` that invokes only the RPC.
- Update mocked-client tests for queries, RPC parameters, rejection/error messages, and the no-proposal-start regression.

**Step 5: Update the web proof UI minimally**

- Show an `✧ Agent proposal` card with source/time and “Nothing applied yet.”
- Provide Review, Accept workout, and Dismiss/return-to-agent copy only where the backend behavior actually exists. If external revision handoff is not implemented, label it “Ask your LLM to send a revised proposal” and do not claim a deep-link handoff.
- After acceptance, show `◇ Planned`; only then show Start workout.

**Step 6: Verify and commit**

```bash
npm run test:run -- src/workout/workoutApi.test.ts src/components/WorkoutView.test.tsx
supabase db reset --local
docker exec -i supabase_db_agym psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/gym-plan-acceptance.sql
npm run typecheck && npm run lint && npm run build
```
Expected: focused tests pass, SQL accepts owner-only lifecycle and rejects bypasses, typecheck/lint/build pass.

Commit:
```bash
git add supabase/migrations supabase/tests src/workout src/components
git commit -m "feat: require user acceptance before gym workout starts"
```

---

### Ticket M2 — Establish the Expo mobile shell and four-tab navigation

**Objective:** prove native authenticated navigation and mobile visual hierarchy on real devices without porting business mutations yet.

**Files:**
- Create: `apps/mobile/package.json`
- Create: `apps/mobile/app.json`
- Create: `apps/mobile/app/_layout.tsx`
- Create: `apps/mobile/app/(auth)/sign-in.tsx`
- Create: `apps/mobile/app/(tabs)/_layout.tsx`
- Create: `apps/mobile/app/(tabs)/today.tsx`
- Create: `apps/mobile/app/(tabs)/calendar.tsx`
- Create: `apps/mobile/app/(tabs)/log.tsx`
- Create: `apps/mobile/app/(tabs)/data.tsx`
- Create: `apps/mobile/src/lib/supabase.ts`
- Create: `apps/mobile/src/auth/sessionStore.ts`
- Create: `apps/mobile/src/theme/tokens.ts`
- Create: `apps/mobile/src/theme/StatusLabel.tsx`
- Create: `apps/mobile/.env.example`
- Create: `docs/mobile/development-and-device-setup.md`
- Test: `apps/mobile/src/auth/sessionStore.test.ts`; component tests only where the chosen Expo test setup supports them

**Steps:**
1. Scaffold Expo Router under `apps/mobile`; do not move root Vite files or change web imports.
2. Configure only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Document that neither is secret; prohibit service-role/MCP/LLM keys from the bundle.
3. Use Expo SecureStore-backed Supabase session persistence. Clear user-scoped in-memory state synchronously before rendering an account switch or sign-out, mirroring `src/auth/AuthGate.tsx`.
4. Implement signed-out/signing-in/signed-in route guards and the required deep-link configuration for development plus the first internal build scheme.
5. Implement the four tabs with Today active by default. Use the v2 dark tokens and semantic `StatusLabel`; do not use color alone.
6. Use static placeholder cards only for layout states. Every placeholder must be labeled as unavailable rather than showing fake training facts.
7. Verify sign-in persistence on one real iOS device and one real Android device/emulator. Record device/OS/app version and result in the device setup doc; do not record credentials.

**Verification:**
```bash
cd apps/mobile
npm run lint
npm run typecheck
npx expo start
```
Expected: native shell starts; an authenticated user can kill/reopen the app without another magic link, then sign out and see account-scoped UI cleared.

Commit:
```bash
git add apps/mobile docs/mobile
git commit -m "feat: add authenticated AGym mobile shell"
```

---

### Ticket M3 — Extract pure Gym contracts and implement native Today states

**Objective:** render proposal, ready, in-progress, completed, and error states from real owner-scoped data without duplicating domain behavior.

**Files:**
- Create when extraction is justified: `packages/core/src/workout/gymSchemas.ts`
- Create when extraction is justified: `packages/core/src/workout/workoutTypes.ts`
- Create: `apps/mobile/src/features/workout/workoutApi.ts`
- Create: `apps/mobile/src/features/today/TodayScreen.tsx`
- Create: `apps/mobile/src/features/today/TodayHero.tsx`
- Create: `apps/mobile/src/features/today/TodayHero.test.tsx`
- Modify: `src/workout/gymSchemas.ts`, `src/workout/workoutApi.ts`, and imports only if the extraction is accepted
- Test: schema/query mapping tests in both consumers or the extracted package

**Steps:**
1. Identify the smallest pure types/helpers currently in `src/workout/gymSchemas.ts` that mobile needs. Extract only those; retain Supabase clients in their respective apps.
2. Add mobile query functions with explicit result states: `no_session`, `proposal_waiting`, `ready`, `in_progress`, `confirmed`, `sync_failed`, `auth_error`, `network_error`.
3. Build Today’s single hero card per state:
   - `no_session`: no primary CTA; secondary “Log unplanned workout” is visually present but disabled/not implemented unless text capture ships in the same ticket.
   - `proposal_waiting`: proposal banner above, never replacing a valid in-progress draft.
   - `ready`: `◇ Planned` plus Start workout.
   - `in_progress`: Resume and elapsed time.
   - `confirmed`: state card, View in Log, Edit actuals only if a revision policy exists; otherwise omit it.
   - `sync_failed`: explicit saved-locally message and Retry sync only after outbox exists; before then use a network error state, not a fake retry.
4. Test all state mappings and ensure a `proposed` plan cannot render as ready.
5. Conduct a founder visual review at phone width against `MOBILE-UI-v2.md`.

**Verification:**
```bash
npm run test:run -- src/workout/gymSchemas.test.ts src/workout/workoutApi.test.ts
cd apps/mobile && npm run typecheck
```
Expected: query/state tests pass; mobile client compiles; native Today renders the correct state for a test owner.

---

### Ticket M4 — Native workout execution with durable local drafts

**Objective:** make the planned-versus-actual gym-floor workflow fast, explicit, and recoverable through app restart/network failure.

**Files:**
- Create: `apps/mobile/src/features/workout/WorkoutExecutionScreen.tsx`
- Create: `apps/mobile/src/features/workout/useWorkoutExecution.ts`
- Create: `apps/mobile/src/features/workout/ActualSetEditor.tsx`
- Create: `apps/mobile/src/features/workout/ConfirmActualSessionScreen.tsx`
- Create: `apps/mobile/src/features/workout/RestTimer.tsx`
- Create: `apps/mobile/src/storage/localExecutionDraft.ts`
- Create: `apps/mobile/src/storage/outbox.ts`
- Create: tests next to execution reducer, draft store, outbox, and confirmation mapping
- Modify only if a proven server gap exists: a new dated migration and SQL regression test

**Steps:**
1. Write failing reducer tests for: planned set unchanged; actual set differs; undo; user-added set; skipped exercise with verbatim reason; user note preserved verbatim; completed execution locked.
2. Render the immutable ghost-plan reference above each actual input. Do not copy actual values back into `planned_snapshot`.
3. Persist every actual edit and note locally before attempting a network save. Draft records must be user/account scoped and cleared on sign-out/account switch.
4. Add an idempotent outbox operation for remote draft saves. The initial design must have explicit `saved locally`, `syncing`, `synced`, and `sync failed` states; do not silently retry forever or claim the LLM can read an unsynced session.
5. Use the existing `complete_gym_workout_execution` RPC for terminal completion. A successful local draft save is not a confirmed workout.
6. Add Confirm Actuals before completion. It must list planned-versus-actual deltas, skipped exercises, and raw note exactly as entered. `Confirm session` is the only completion CTA.
7. Add rest timer start only when the user logs a set. Test background/foreground behavior on physical devices.
8. Prove offline edit → process restart → restore draft → reconnect → one remote save → confirm; prove duplicate completion remains rejected by the RPC.

**Verification:**
```bash
cd apps/mobile
npm run test -- --run src/features/workout src/storage
npm run typecheck
```
Then run the existing database proof:
```bash
supabase db reset --local
docker exec -i supabase_db_agym psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/gym-workout-execution.sql
```
Expected: reducer/outbox tests pass; SQL still proves completed rows cannot be browser-mutated or cross-user completed.

---

### Ticket M5 — Calendar proposal review and revision handoff contract

**Objective:** ship an honest native review surface for one Gym proposal and define an external-LLM revision contract without creating in-app chat.

**Files:**
- Create: `apps/mobile/src/features/calendar/CalendarScreen.tsx`
- Create: `apps/mobile/src/features/plans/PlanReviewScreen.tsx`
- Create: `apps/mobile/src/features/plans/RevisionHandoffScreen.tsx`
- Create: `apps/mobile/src/features/plans/planReview.test.ts`
- Modify: `mcp/agym-server.ts` and `mcp/e2e.mts` only if a minimal revision-request persistence contract is approved
- Modify/Create: Supabase migration/tests only if persistence is approved
- Create: `docs/architecture/external-plan-revision-contract.md`

**Steps:**
1. Render scheduled active plans, confirmed executions, and proposal cards with distinct status labels.
2. For v1 single-workout proposals, the review explains: source/client, creation time, scheduled date, prescribed exercises/sets, and that nothing is applied until acceptance.
3. Use Accept / Dismiss. Do not show “Apply 8 selected,” load deltas, multi-week diffs, or plan history until the schema represents plan bundles and individual changes.
4. Build a structured no-chat revision form: reason chips plus optional verbatim note. It must state exactly what will be shared and that AGym itself will not mutate plans from an external conversation.
5. Before adding any deep link or open-Claude action, document and test the platform return mechanism, proposal correlation/version, cancellation, external-app-unavailable state, and revised-proposal ingestion. If this cannot be proven on iOS and Android, release a copyable structured revision request rather than a broken handoff.
6. Do not persist raw full revision conversation text or grant new scopes implicitly.

**Verification:**
```bash
cd apps/mobile && npm run typecheck
npm run test -- --run src/features/plans
```
Expected: proposal renders as unapplied, acceptance calls only the owner-scoped RPC, and revision UI never claims an in-app chat exists.

---

### Ticket M6 — Log and Data trust surfaces, then device-alpha gate

**Objective:** close the user-facing trust loop for confirmed history, bounded evidence, permissions, export/delete, and mobile release readiness.

**Files:**
- Create: `apps/mobile/src/features/log/LogScreen.tsx`
- Create: `apps/mobile/src/features/log/ConfirmedSessionDetail.tsx`
- Create: `apps/mobile/src/features/data/DataScreen.tsx`
- Create: `apps/mobile/src/features/data/ModelScopeCard.tsx`
- Create: `apps/mobile/src/features/data/dataApi.ts`
- Create: `docs/mobile/release-checklist.md`
- Create: `docs/mobile/privacy-and-permissions.md`
- Modify: `docs/deploy/going-live.md`
- Test: data-state mapping and two-account isolation tests for each newly exposed endpoint

**Steps:**
1. Build Log from confirmed outcomes only. Each detail view shows actual set data, linked plan reference, completion time, and raw note/evidence; it must not fabricate a weekly inference.
2. For the first release, show a facts-only briefing summary with direct session links. Do not render `≈ Observation` until a server-side derivation has an inspectable evidence/data-window contract.
3. Render Data as two separate sections: sources connected to AGym and models granted access. For the existing Hermes integration, expose only verified scopes (`read_context`, `write_proposed_plan`), revocation, and audit facts already supported by data/API.
4. Do not claim Strava, Apple Health, nutrition, model “full history,” last-access detail, or access history unless it is stored and retrievable through an owner-scoped API.
5. Verify native-created data appears in JSON export and that account deletion clears remote account data plus SecureStore/outbox state. Deletion remains a hard release gate.
6. Execute the real-device acceptance flow on iOS and Android: persistent sign-in, proposal, acceptance, execution, offline draft/reconnect, confirmation, Log, permission revoke, export, and deletion.

**Verification:**
```bash
npm run typecheck && npm run lint && npm run build
cd apps/mobile && npm run typecheck && npm run lint
npm run mcp:smoke
```
Then run the documented real-device checklist and record only non-sensitive evidence/results.

---

## 3. Explicitly deferred after M6

- Multi-week blocks, plan bundles, partial selection, load-change calculations, and 30-day rollback UI.
- Native Strava, Apple Health, Cronometer, and any imported-data review workflow.
- Voice capture until the documented iOS/Android privacy, offline, quality, retention, and cost spike is approved.
- Health/fueling/sleep correlations and any derived observation without a durable source/evidence model.
- More than one general model connector or model-key management.
- External self-serve remote MCP/OAuth/DCR distribution.
- Social, streaks, leaderboard, subscriptions, coach roster, and medical/coaching recommendations.

## 4. Per-PR quality gate

Every ticket must:

1. Use a clean branch/worktree and avoid the current unrelated marketing/untracked files.
2. Add failing tests before implementation where behavior can be tested.
3. Run focused tests, then relevant database/RLS tests, typecheck, lint, and build.
4. Inspect the final diff for secrets, user-data claims, provenance regressions, and accidental direct browser terminal-status writes.
5. For native UI, run manual device QA at phone width; screenshots alone are not enough.
6. Report scope, tests actually run, risks, and deliberate deferrals. Do not mark a feature complete based only on compilation.

## 5. First implementation PR

Start with **M0**, then open **M1** as the first code PR. M1 is the smallest high-leverage correction because it makes the current hosted web execution path consistent with v2’s central trust promise: an agent proposal cannot become a workout the user can start until the user explicitly accepts it.
