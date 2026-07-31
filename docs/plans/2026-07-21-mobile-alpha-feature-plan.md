# AGym Mobile Alpha and Feature-Completion Plan

> **For Hermes:** use `subagent-driven-development` to implement this plan issue-by-issue in clean worktrees. Do not combine the phases in one PR.

**Status:** proposed — planning artifact, not implementation authorization.

**Goal:** turn the existing hosted AGym alpha into a mobile-first iOS/Android app that lets a signed-in user receive an agent-authored workout, execute it quickly, capture reality by voice or text, correct uncertainty, and return user-confirmed outcomes to their connected agent.

**Architecture:** retain the hosted Supabase/Auth/RLS/MCP system as the shared data and trust boundary. Add a native Expo/React Native client at `apps/mobile`; keep the existing Vite client as the founder/admin/browser companion during alpha. Share only schemas, API contracts, and pure domain logic after a small extraction; do not try to share React components or CSS. Preserve the current raw → uncertain draft → user-confirmed event/provenance model.

**Proposed stack:** Expo + React Native + TypeScript; Expo Router; Supabase JS client with persisted native auth storage; Zustand; Zod; Expo SecureStore; Expo Audio/FileSystem; EAS Build/Submit later; existing Supabase/Postgres/RLS and local/remote MCP surfaces.

**Explicit non-goals for this plan:** a full AI coach, autonomous training recommendations, medical advice, wearable imports, social features, coach roster/dashboard, subscriptions/payments, or an unreviewed third-party exercise-media bundle.

---

## 0. Correct the MCP status before planning more work

The Claude Desktop integration already working for the founder is a valid proof of the AGym MCP loop. The previously described Keycloak/DCR work is **not** a statement that Claude Desktop cannot use AGym.

There are two distinct delivery modes:

1. **Current, working founder integration:** Claude Desktop/Hermes is configured with AGym MCP and can read context and write proposals for the founder account. This validates the agent plan → mobile/web outcome → agent context loop.
2. **Separate later distribution track:** a browser-hosted remote MCP endpoint that unknown external Claude users can connect to through Claude’s custom remote-connector OAuth/DCR flow. The Keycloak identity-bridge plan applies only here. It is not required to build or test the mobile alpha with the existing founder connection.

**Planning action:** patch the status language in `docs/plans/2026-07-16-remote-mcp-phase-b-keycloak.md` and the project status record to say “external self-serve remote-connector compatibility pending,” not “Claude Desktop blocked.” Do this in a documentation-only PR.

**Verification:** confirm the current Claude Desktop configuration can call `get_context`, list plans, and create a proposed gym workout for the founder account; record only the result and tool names, never credentials or config secrets.

---

## 1. Product boundary and acceptance demo

Before mobile code, lock the one demo that every feature must improve:

```text
Claude/Hermes proposes today’s workout
→ AGym mobile shows an immutable planned baseline
→ user performs and edits the actual sets
→ rest timer and notes reduce gym-floor friction
→ user speaks or types a messy outcome
→ AGym preserves the raw evidence, creates an uncertain draft where applicable
→ user confirms/corrects
→ agent retrieves bounded context that labels raw versus confirmed reality
```

### Definition of a successful mobile-alpha session

- A signed-in user can reopen the app without a new magic-link loop unless they explicitly sign out or the session expires.
- The default screen is Today’s Workout when a plan is scheduled; otherwise it gives one fast path to capture a log.
- Completing a workout does not mutate the agent plan. It creates the existing linked user-confirmed outcome.
- Any speech recognition output is displayed as editable raw text before a parser or user confirmation can treat it as structured information.
- Network failure never silently loses a set, note, or raw text. The exact offline/sync behavior is designed and tested before inviting external users.
- An agent context pull can distinguish raw evidence, uncertain drafts, and user-confirmed outcomes.

### Metrics to instrument from the first mobile build

Do not build a dashboard yet. Store a minimal privacy-reviewed event ledger for:

- time from opening a workout to first completed set;
- workout completion rate;
- raw-log creation rate after a workout;
- draft confirmation/correction/discard rate;
- time to confirm;
- voice capture started → transcript accepted rate;
- plan → at least one real outcome completion rate;
- agent context-pull count.

No health content, raw transcripts, audio, or full plan text should be copied into generic analytics payloads.

---

## 2. Design baseline already available

Use `docs/design/APP-UI.md` as the accepted visual-system baseline. It already defines the intended app UI: dark-first near-black surfaces, cream typography, one orange action/uncertainty accent, raw/draft/canonical visual distinction, and a non-gamified mobile hierarchy.

### Mobile navigation mapping

| Mobile destination | Existing surface / design rule | Priority |
| --- | --- | --- |
| Today | `WorkoutView`; agent proposal versus actual execution; rest timer | P0 |
| Capture | `LogInput` + draft preview; voice and text entry | P0 |
| Plans | `PlansView`; immutable agent-written proposal cards | P0 |
| History | timeline + confirmed outcomes, no chart dashboard | P1 |
| Briefing | export/copy agent context and Coach Briefing | P1 |
| Data & privacy | export, account deletion, permission explanation | P0 |

### Founder-review gate

Before implementation of the native screen set, produce a screen-by-screen mapping of the supplied/founder-approved UI to the six destinations above. If a Figma file, screenshot set, or separate UI repository exists beyond `docs/design/APP-UI.md`, attach it to this plan and update the mapping before coding. Do not invent visual direction during implementation.

---

## 3. Technical decisions to make once, early

### Decision A — native client

**Proposed choice:** Expo-managed React Native, targeting iOS and Android from one TypeScript codebase.

Why:
- real native mobile app rather than a browser shell;
- supports secure credential storage, microphone permission, background-safe persistence, push capability later, and App Store/TestFlight distribution;
- keeps TypeScript/Zod/Zustand/Supabase familiarity from the existing app;
- avoids a native iOS + native Android split during alpha.

Do **not** rebuild the Vite web app in Expo. Keep it alive as a browser companion until the native app proves the daily loop.

### Decision B — repository shape

Use a small workspace only after the mobile app is scaffolded:

```text
apps/
  web/                 # existing Vite app moved only in a dedicated migration PR
  mobile/              # Expo app
packages/
  core/                # Zod contracts, pure domain helpers, test fixtures
  supabase-client/     # optional only after web/mobile duplicate authenticated queries
mcp/                   # stays Node/tsx; never imported into the mobile bundle
supabase/
```

Safer first step: create `apps/mobile` without moving current web files. Extract a `packages/core` module only when a mobile feature needs a tested shared type/function. Do not introduce a generic repository platform or design system package.

### Decision C — mobile auth

Use Supabase auth with platform-aware persistence:
- native session persistence in Expo SecureStore;
- deep-link redirect configuration for development, TestFlight/internal builds, and production;
- clear user-scoped Zustand state synchronously on sign-out/account switch;
- no service-role key, MCP identity, or LLM provider secret in the app.

### Decision D — offline behavior

P0 requires local durable drafts/outbox for in-progress workout edits and raw capture. It does **not** require arbitrary bidirectional offline database replication.

- Save in-progress workout edits and raw text locally immediately.
- Queue owner-scoped writes with idempotency/client IDs.
- Reconcile when online; show Syncing / Saved locally / Sync failed states.
- Do not permit a queued request to bypass the existing RLS/RPC terminal-completion rules.

### Decision E — voice

Voice is a capture modality, not an automatic truth engine.

Phase 1 supports: tap to record → visible recording state → editable transcript/raw text → user submits it as raw self-report.

Before selecting a speech library or service, run a small iOS + Android spike comparing:
- on-device platform speech recognition through a maintained Expo-compatible native module;
- a privacy/consent-reviewed server transcription service;
- manual audio attachment plus later transcription.

The spike must measure permission flow, language support, latency, cost, offline behavior, transcript quality for exercise/load notation, retention/deletion implications, and whether raw audio must be stored. No paid transcription API or third-party health-data processor is adopted without explicit founder approval and consent design.

---

## 4. Exercise dataset plan: use it as a catalogue, not as truth or a blocker

Candidate identified: `hasaneyldrm/exercises-dataset` (`hasaneyldrm/exercises-dataset`). It currently advertises 1,324 exercises, GIFs/thumbnails, muscle/equipment fields, and multilingual instructions. Its GitHub API license field is `NOASSERTION` even though the repository contains `LICENSE`/`NOTICE.md`.

### Guardrails

- Do not copy the dataset, GIFs, videos, or thumbnails into AGym, Git, Supabase Storage, or a mobile binary until the actual `LICENSE` and `NOTICE.md` are reviewed and redistribution rights are confirmed.
- Dataset labels must never rewrite a user’s original raw wording or confirmed `exercise_name` silently.
- The catalogue is for optional search, aliases, exercise detail, and substitution UX later. It is not an authority for medical safety, personalized form advice, or training prescriptions.
- A remote media URL must be treated as an external dependency with availability/privacy/caching implications; do not hotlink it by default in a private-alpha workout flow.

### Dataset spike deliverable

Create `docs/research/exercise-dataset-evaluation.md` containing:
1. precise upstream commit/version and actual license/notice conclusion;
2. field inventory and example record;
3. match strategy: display alias/catalog ID separate from user-entered name;
4. media strategy: no media, approved remote media, or explicitly licensed optimized derivative;
5. size/performance estimate for metadata-only catalogue versus media;
6. quality checks for duplicates, missing equipment/body-part values, and multilingual fields;
7. recommendation: adopt, request permission, use metadata-only, or reject.

Only then create a small normalized `exercise_catalogue` storage/query layer. The mobile P0 workout executor works without it.

---

## 5. Delivery sequence — scoped issues and PRs

### Phase 0 — documentation and living-alpha audit

**Objective:** align docs with the working Claude integration and prove the existing mobile-browser loop before changing clients.

**Files:**
- Modify: `docs/plans/2026-07-16-remote-mcp-phase-b-keycloak.md`
- Modify: project status/roadmap document identified during branch setup
- Create: `docs/plans/2026-07-21-mobile-alpha-feature-plan.md` (this document)
- Create: `docs/research/exercise-dataset-evaluation.md`

**Steps:**
1. Correct the Claude/MCP distinction in docs.
2. Run the current founder end-to-end loop: propose structured plan → open hosted app on a phone browser → execute → confirm outcome → retrieve context.
3. Record passed/failed steps and only verified gaps.
4. Perform the exercise-dataset license/structure spike.
5. Commit documentation only.

**Verification:** current MCP tool calls work; deployed web app works on phone; no secrets enter documentation.

---

### Phase 1 — mobile architecture spike and Expo scaffold

**Objective:** prove native authentication, navigation, and a secure build pipeline before porting product logic.

**Files:**
- Create: `apps/mobile/package.json`
- Create: `apps/mobile/app.json`
- Create: `apps/mobile/app/_layout.tsx`
- Create: `apps/mobile/app/(auth)/sign-in.tsx`
- Create: `apps/mobile/app/(tabs)/today.tsx`
- Create: `apps/mobile/src/lib/supabase.ts`
- Create: `apps/mobile/src/auth/sessionStore.ts`
- Create: `apps/mobile/.env.example`
- Create: `docs/mobile/development-and-device-setup.md`

**Steps:**
1. Create a clean branch/worktree from current `origin/main`; do not absorb existing uncommitted marketing/docs work.
2. Scaffold Expo with TypeScript and Expo Router under `apps/mobile`.
3. Configure only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; document that both are public/browser-visible and that no secret/service-role key is allowed.
4. Add SecureStore-backed Supabase auth persistence and a signed-in/signed-out route guard.
5. Configure Supabase redirect/deep-link URLs for Expo development and the first internal-distribution scheme.
6. Add one dark-first Today placeholder and one Capture placeholder using the existing visual tokens translated into React Native constants.
7. Run on an actual iOS device and Android device/emulator; do not accept simulator-only proof.
8. Commit the scaffold separately.

**Tests:** unit-test auth configuration/session-state reset; manually test sign-in → app kill/reopen → session persists → sign-out clears account state.

**Acceptance:** both platforms reach a signed-in native shell and can read the authenticated user without exposing secrets.

---

### Phase 2 — shared contracts and native read surfaces

**Objective:** render the existing user-scoped plan and execution data natively without changing its backend semantics.

**Files:**
- Create only when needed: `packages/core/src/workout/gymSchemas.ts`
- Create only when needed: `packages/core/src/workout/workoutTypes.ts`
- Create: `apps/mobile/src/features/workout/workoutApi.ts`
- Create: `apps/mobile/src/features/workout/TodayWorkoutScreen.tsx`
- Create: `apps/mobile/src/features/plans/PlansScreen.tsx`
- Create: `apps/mobile/src/theme/tokens.ts`
- Create: `apps/mobile/src/theme/components.ts`
- Test: colocated Vitest tests for query mapping and state behavior

**Steps:**
1. Copy no business logic blindly. Identify the minimum pure types/functions shared by `src/workout/gymSchemas.ts` and mobile, extract them with tests, and update web imports in the same PR.
2. Implement Today’s Workout native read state: loading, no scheduled plan, plan available, existing in-progress execution, completed execution, auth/network error.
3. Implement the immutable agent proposal card and visual distinction between planned baseline and actual values.
4. Implement Plans native read surface with proposal/provenance labels.
5. Review screen against `docs/design/APP-UI.md` at phone width with the founder.

**Acceptance:** a plan written through existing MCP is visible in native Today/Plans for only its owner; another account cannot read it.

---

### Phase 3 — native workout execution and safe local draft persistence

**Objective:** make the gym-floor loop genuinely faster than the web version.

**Files:**
- Create: `apps/mobile/src/features/workout/WorkoutExecutionScreen.tsx`
- Create: `apps/mobile/src/features/workout/useWorkoutExecution.ts`
- Create: `apps/mobile/src/features/workout/localExecutionDraft.ts`
- Create: `apps/mobile/src/features/workout/RestTimer.tsx`
- Create: `apps/mobile/src/storage/outbox.ts`
- Modify only if schema gap is proven: new dated migration under `supabase/migrations/`
- Test: execution reducer, idempotent outbox, completion/error states

**Steps:**
1. Render exercise/set controls optimized for one-handed use: large completion target, weight/reps edit, add set/exercise, and save state.
2. Persist every local change before network sync; use an outbox record keyed to existing client/execution identifiers.
3. Reuse the existing secure `complete_gym_workout_execution` RPC rather than permitting a client update to `completed`.
4. Start/restart the rest timer only after a user marks a set complete; test background/foreground behavior explicitly.
5. Show clear statuses: Saved locally, Syncing, Synced, Needs attention. Do not claim a completed workout if the terminal RPC failed.
6. Test connectivity loss while editing, app restart, reconnection, repeated submit, and cross-account switch.

**Acceptance:** the same plan/outcome immutability, provenance, and RLS protections that exist on web hold in native execution.

---

### Phase 4 — text capture, raw evidence, and correction UX

**Objective:** replace developer-oriented JSON editing with rapid human correction while preserving uncertainty.

**Files:**
- Create: `apps/mobile/src/features/capture/CaptureScreen.tsx`
- Create: `apps/mobile/src/features/capture/RawLogComposer.tsx`
- Create: `apps/mobile/src/features/capture/DraftReview.tsx`
- Create: `apps/mobile/src/features/capture/FieldCorrection.tsx`
- Create: `apps/mobile/src/features/history/HistoryScreen.tsx`
- Modify: server parsing boundary only after its current contract/tests are read and a typed response is specified

**Steps:**
1. Implement text-first capture with source/date/plan context; write raw text before attempting structured parse.
2. Add draft-review cards with chips/inline fields for exercise, set, reps, load, date, and uncertainty reason. Keep raw JSON only behind an advanced/debug affordance if still needed.
3. Ensure confirm creates the existing user-confirmed canonical record, never overwrites the raw evidence or uncertain parse.
4. Implement a simple history list that visibly labels raw/draft/canonical status; no analytics charts in this phase.
5. Add unit, UI, and two-account RLS tests for all capture transitions.

**Acceptance:** a user can correct a questionable parse in a few taps, and an agent subsequently sees the confirmed result plus correctly labelled raw evidence.

---

### Phase 5 — voice capture spike, then gated voice implementation

**Objective:** validate that voice reduces logging friction without creating a privacy or cost surprise.

**Spike files:**
- Create: `apps/mobile/src/spikes/voice/README.md`
- Create: `docs/research/mobile-voice-capture-decision.md`

**Spike protocol:**
1. Test on one real iOS device and one real Android device with gym-relevant phrases: exercise aliases, weights/units, reps, RPE/RIR, rest, substitutions, pain/discomfort language, and mixed Italian/English if needed.
2. Capture permission UX, average latency, transcript error types, app-background behavior, and whether recognition is on-device or sends audio to a provider.
3. Decide whether audio is discarded immediately after transcription or stored as user-controlled evidence. Default is discard; retention requires explicit consent, export/delete support, and storage cost review.
4. Obtain founder approval for chosen provider/cost/privacy path before non-spike implementation.

**If approved implementation files:**
- Create: `apps/mobile/src/features/voice/VoiceCaptureButton.tsx`
- Create: `apps/mobile/src/features/voice/useVoiceCapture.ts`
- Create: `apps/mobile/src/features/voice/VoicePermissionExplainer.tsx`
- Modify: `RawLogComposer.tsx`

**Acceptance:** the user can cancel, retry, edit, or submit a transcript as raw text. A transcript is never silently treated as confirmed structured workout data.

---

### Phase 6 — exercise catalogue, only after licensing decision

**Objective:** add searchable exercise metadata without conflating it with self-report or shipping unauthorized media.

**Files (metadata-only first):**
- Create: `scripts/import-exercise-catalogue.mts`
- Create: `packages/core/src/exercises/catalogueSchemas.ts`
- Create: dated migration(s) only if Supabase-backed catalogue is chosen
- Create: `apps/mobile/src/features/exercises/ExercisePicker.tsx`
- Create: `apps/mobile/src/features/exercises/ExerciseDetail.tsx`
- Create: `docs/research/exercise-catalogue-provenance.md`

**Steps:**
1. Pin exact upstream source revision and record license/provenance.
2. Import only approved metadata fields; do not download or redistribute media unless separately approved.
3. Keep `catalogue_exercise_id`/selected display alias separate from original user-entered exercise text.
4. Support search/filter by name, equipment, and body part; show source attribution where required.
5. Add deterministic import validation and tests for stable IDs, duplicates, missing mandatory fields, and no mutation of raw/canonical names.

**Acceptance:** an exercise can be selected for a user-added workout row without rewriting what the user actually logged.

---

### Phase 7 — privacy, release, and external-alpha gates

**Objective:** ship an invite-only TestFlight/Android internal test build only after user-data ownership and mobile-specific risks are proven.

**Files:**
- Create: `docs/mobile/release-checklist.md`
- Create: `docs/mobile/privacy-and-permissions.md`
- Modify: `docs/deploy/going-live.md`
- Create: CI workflow(s) only after build platform choice is confirmed

**Required proofs:**
1. Export includes native-created records and preserves provenance.
2. Account deletion works for an account created/used in mobile; local SecureStore/outbox data is also cleared after successful deletion/sign-out.
3. Microphone permission has plain-language purpose text and a no-voice fallback.
4. Two-user RLS isolation is proven for native reads/writes and queued replay.
5. A real device smoke test covers sign-in persistence, deep link, Today, execution, rest timer, offline edit/reconnect, text capture, correction, export/delete.
6. EAS/internal distribution credentials are kept outside Git/chat; builds are reproducible from documented non-secret configuration.
7. No external tester receives a claim of clinical advice, automatic diagnosis, or autonomous coaching.

---

## 6. Recommended first three tickets

1. **Docs/status and exercise-dataset due-diligence** — correct the Claude MCP wording, audit dataset license/fields, and document the native architecture decision.
2. **Expo mobile auth shell** — signed-in persistent native shell, deep links, dark-first Today/Capture placeholders, tested on real iOS and Android hardware.
3. **Native Today workout read/execution** — mobile rendering and secure completion of MCP-authored gym plans, with local draft persistence and an offline/reconnect test.

Voice and catalogue search intentionally come after the mobile workout loop is fast and reliable.

## 7. Decisions that require founder review before implementation

- Confirm `docs/design/APP-UI.md` is the full UI baseline, or supply the additional Figma/screenshots/repository to map before native UI work.
- Confirm Expo/React Native as the iOS + Android delivery choice.
- Confirm whether the web app remains a founder/admin companion during mobile alpha (recommended: yes).
- Approve any paid/cloud speech-to-text provider only after the voice spike presents cost, privacy, quality, and consent evidence.
- Approve use of `hasaneyldrm/exercises-dataset` only after review of its actual license/NOTICE and a deliberate media/redistribution decision.

## 8. Quality gates for every implementation PR

- scoped clean worktree/branch; no unrelated marketing or planning files absorbed;
- focused tests first, then lint, typecheck, build, and relevant Supabase/RLS proofs;
- manual device verification for UI, auth, microphone, timer, and offline-sensitive changes;
- visual review against `docs/design/APP-UI.md` at real phone width;
- no secrets in code, mobile public environment, screenshots, or commits;
- no status claimed “complete” until an actual founder device proof is recorded.
