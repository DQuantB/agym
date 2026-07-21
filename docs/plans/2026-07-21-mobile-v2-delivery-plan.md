# AGym Mobile v2 Delivery Plan

> **For Hermes:** implement one ticket per clean branch/worktree. Use a fresh implementer, then specification and code-quality review before proceeding.

**Goal:** ship a native mobile alpha where an external LLM proposes one scheduled Gym workout, the user explicitly accepts it, logs immutable planned intent versus actual training, confirms the outcome, and returns only authorized context to the LLM.

**Architecture:** retain the hosted Supabase/Auth/RLS/MCP trust boundary defined in [ADR 0002](../adr/0002-networked-agent-alpha.md). Add a standalone Expo/React Native client in `apps/mobile`; retain the Vite web client as the founder/admin companion. Share only tested Zod schemas and pure domain helpers when needed; do not share React components or CSS. The existing Gym database boundary remains defined by [Gym Workout Execution](2026-07-14-gym-workout-execution.md).

**Tech stack:** Expo, React Native, Expo Router, Expo SecureStore; TypeScript, Zod, Supabase Auth/Postgres/RLS, MCP SDK, Vitest. No secret/service-role/LLM credential enters the native bundle.

**Hard constraints:** plan immutable; actual execution separate; raw evidence preserved; only user confirmation creates a confirmed outcome; model access authorized and revocable; no medical claims; no in-app chat; no silent agent mutation.

## M0 — Commit the mobile v2 contract

**Files:** `docs/design/MOBILE-UI-v2.md`, `docs/design/APP-UI.md`, this plan.

Capture the four-tab IA, Today state machine, provenance labels, planned-versus-actual rule, accessibility requirements, and alpha/deferred boundary. `APP-UI.md` stays the web-v1 token/visual baseline; its top-pill navigation does not prescribe native IA.

**Verify:** `git diff --check`; founder review of the screen-map-to-contract mapping.

## M1 — Require explicit user acceptance before a Gym workout starts

**Current defect:** `src/components/WorkoutView.tsx` calls `loadWorkout`, whose current scheduled-Gym-plan query is not status-filtered. A `proposed` plan can therefore behave like a startable workout, violating “nothing applied yet.”

**Files:** new dated migration and `supabase/tests/gym-plan-acceptance.sql`; `src/workout/workoutApi.ts` and tests; `src/components/WorkoutView.tsx` and tests; minimal `PlansView` proposal-review copy.

**Behavior:** add an owner-scoped authenticated RPC that derives `auth.uid()`, accepts only the owner’s valid Gym `proposed → active` transition, preserves agent provenance/text/data, and rejects browser/self-service status bypasses. Separate proposal read from active-workout read. Only an accepted `active` Gym plan can create/start `workout_executions`; proposals remain review-only. Do not add multi-week plan tables or partial-selection semantics.

**Verify:** failing then passing SQL tests for owner acceptance, cross-user denial, direct browser-status denial, no proposed-start regression, and completed-execution immutability; focused Vitest; `supabase db reset --local`; `npm run typecheck && npm run lint && npm run build`.

## M2 — Scaffold the Expo mobile shell

**Files:** `apps/mobile/app.json`, Expo Router layouts and four tab routes; `apps/mobile/src/lib/supabase.ts`; SecureStore auth/session store; `apps/mobile/src/theme/*`; `.env.example`; `docs/mobile/development-and-device-setup.md`.

**Behavior:** persistent authenticated native session, deep-link configuration, synchronous account-state clear on sign-out/account switch, and Today/Calendar/Log/Data placeholders using the v2 semantic status language. Only public Supabase URL/publishable key are documented in native env configuration.

**Verify:** auth/session unit test, typecheck/lint, and real iOS plus Android sign-in → kill/reopen → session persists → sign-out/account state clears proof.

## M3 — Render real native Today states

**Files:** extract `packages/core` only if a tested pure Gym schema/helper is genuinely shared; `apps/mobile/src/features/workout/workoutApi.ts`; `apps/mobile/src/features/today/*` and state-mapping tests.

**Behavior:** map real owner-scoped data to `no_session`, `proposal_waiting`, `ready`, `in_progress`, `local_draft`, `confirmed`, network/auth error. Proposal is a banner/review path, never ready. Confirmed state cannot present restart/completion action. Do not display a fake retry before M4 has an outbox.

**Verify:** query/state mapping tests; native phone-width founder review; explicit test that proposed plans cannot render as `ready`.

## M4 — Native execution, local drafts, and confirmation

**Files:** `apps/mobile/src/features/workout/WorkoutExecutionScreen.tsx`, `ActualSetEditor.tsx`, `ConfirmActualSessionScreen.tsx`, `RestTimer.tsx`, reducer/hook; account-scoped `localExecutionDraft.ts` and `outbox.ts`; tests for reducer/outbox/confirmation.

**Behavior:** retain an immutable ghost plan beside editable actual sets. Locally persist every edit/note before network sync. Support user-added sets, skips with verbatim reason, and rest timer after set completion. Surface `Saved locally`, `Syncing`, `Synced`, and `Sync failed`. Complete only through existing `complete_gym_workout_execution`; local save is never confirmed completion. Review actual deltas before `Confirm session`.

**Verify:** offline edit → process restart → restore → reconnect → one save; duplicate completion rejection; existing Gym SQL lifecycle proof; real iOS/Android timer background/foreground test.

## M5 — Calendar proposal review and no-chat revision contract

**Files:** `apps/mobile/src/features/calendar/*`, `apps/mobile/src/features/plans/*`, tests, and `docs/architecture/external-plan-revision-contract.md`. Add MCP/database persistence only after the return contract is approved.

**Behavior:** Calendar distinguishes active plan, confirmed execution, and proposal. The initial review handles one Gym proposal: source/time, date, exercises/sets, accept or dismiss. `Ask for changes` gathers structured reason plus optional verbatim note and explains external handoff. It does not create chat, claim deep-link success, or permit external text to write AGym directly.

**Verify:** proposal is visibly unapplied; acceptance uses only M1 RPC; revision contract covers correlation/version, cancellation, external-app unavailable, and return as a new proposal before any deep link ships.

## M6 — Log/Data trust surfaces and device-alpha gate

**Files:** `apps/mobile/src/features/log/*`, `apps/mobile/src/features/data/*`, owner-scoped API mapping tests, `docs/mobile/release-checklist.md`, `docs/mobile/privacy-and-permissions.md`, relevant `docs/deploy/going-live.md` update.

**Behavior:** Log shows confirmed sessions with actuals, linked plan, and source evidence; no unsupported weekly observation. Data distinguishes sources connected to AGym from models authorized to read; expose only verified current scopes, revocation, audit facts, export, and deletion behavior. Native-created data must export; deletion/sign-out clear SecureStore/outbox as well as remote account data.

**Verify:** two-account isolation for each exposed query; export/delete proof; real-device loop: auth persistence, proposal, acceptance, execution, offline/reconnect, confirmation, Log, revoke, export, delete.

## Explicit deferrals

- Multi-week bundles, per-session partial acceptance, load-delta calculation, and plan-history rollback.
- Strava, Apple Health, Cronometer, imports, and imported-data review.
- Voice capture/transcription until a real-device privacy, retention, quality, offline, and cost spike is approved.
- Sleep/fueling/injury or other derived health observations until source/evidence/data-window contracts exist.
- Multiple general model connectors and remote self-service MCP/OAuth distribution.
- Social/streaks, payments, coach roster, autonomous training recommendations, medical claims.

## Per-PR quality gate

1. Create a clean issue branch/worktree; do not absorb unrelated local marketing/docs work.
2. Add focused failing tests first where practical; run focused tests before broad gates.
3. Run database/RLS tests for migrations or protected transitions; prove cross-user denial.
4. Run relevant `npm` typecheck, lint, build, and MCP checks; record actual results only.
5. Inspect diff for secrets, direct browser terminal-status writes, provenance regressions, and unsupported UI claims.
6. For native work, complete real-device iOS and Android QA at phone width before claiming completion.
