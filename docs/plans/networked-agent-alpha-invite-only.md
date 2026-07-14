# Networked Agent Alpha (Invite-Only) Implementation Plan

> **For Hermes:** Execute one GitHub issue/branch at a time. Do not merge user data or secrets into Git.

**Goal:** Ship a private, invite-only AGym alpha in which authenticated users can log and confirm outcomes, Hermes can write explicitly authorized plans, and both web and MCP clients read the same user-scoped data.

**Architecture:** Supabase Auth identifies each invited user; Postgres stores raw logs, uncertain LLM drafts, user-confirmed outcomes, plans, and audit/consent records behind RLS. The Vite client uses only the publishable key. A server-side LLM boundary and a local standard-MCP server are introduced after the database and auth boundary are proven.

**Tech stack:** Vite + React + TypeScript, Supabase Auth/Postgres/RLS, Zod, `@supabase/supabase-js`, server-side TypeScript, standard MCP SDK, Hermes.

**Status:** Accepted on 2026-07-13. Supabase project and local public environment configuration are verified. The local-first v0 application remains a prototype and reference implementation; ADR 0002 governs alpha work.

---

## Alpha guardrails

- Private invitation only: disable public self-sign-up; founders add/test users through Supabase Auth invitations.
- Every user-owned table has `user_id uuid not null` and RLS checks `user_id = auth.uid()`.
- Raw user text is immutable after creation. Parsing makes a new draft; user confirmation makes a new canonical outcome.
- LLM drafts are always `llm_parsed_uncertain`; only a web-app user confirmation can create `user_confirmed` outcomes.
- MCP plan writes require a recorded explicit authorization and a source-client audit row. Agents cannot confirm outcomes.
- No service-role key or LLM provider key enters the Vite application, `.env.example`, an MCP client, or Git.
- No medical diagnosis, treatment, risk scoring, autonomous execution, public launch, payments, sharing, or trainer dashboard.

## Phase 0 — Project boundary and configuration (complete)

1. Create the Supabase project on the Free plan.
2. Add the project URL and publishable key only to `.env.local`; verify it is Git-ignored.
3. Commit `.env.example` without values and install `@supabase/supabase-js`.
4. Verify the Supabase Auth settings endpoint from Vite environment loading.

**Evidence:** `.env.local` is ignored; Auth endpoint returned HTTP 200; `npm run typecheck` passed.

## Phase 1 — Database and RLS foundation (next issue)

**Objective:** Create a small, reviewable schema for the alpha and prove that two invited users cannot read or write one another's data.

**Files:**
- Create: `supabase/migrations/20260713T000000_initial_invite_alpha.sql`
- Create: `supabase/tests/rls-isolation.sql`
- Create: `docs/architecture/networked-alpha-schema.md`

**Tables in this migration:**

| Table | Purpose | Required trust boundary |
|---|---|---|
| `profiles` | one row per Supabase Auth user; timezone and unit preference only | user owns exactly their row |
| `raw_logs` | immutable verbatim user input | user-only insert/read/delete |
| `parse_drafts` | LLM-produced, editable, uncertain structure | linked to own raw log; fixed uncertain provenance |
| `canonical_events` | user-confirmed outcome plus final JSON fields | must trace to own raw log; fixed confirmed provenance |
| `plans` | agent-written proposed plan and raw plan text | user-only visibility; never an outcome |
| `agent_authorizations` | explicit, revocable approval for a named agent/client action | user creates/revokes only |
| `agent_audit_log` | append-only record of plan/context actions | own user visibility; no browser update/delete |
| `consent_records` | granular consent such as LLM parsing | user-only visibility and mutation |

**Implementation steps:**
1. Write the migration using `uuid`, UTC timestamps, constrained enums/checks, foreign keys, and indexes on `(user_id, created_at desc)`.
2. Add a `handle_new_user()` trigger that creates the minimal `profiles` row from `auth.users`; the client must not choose another user's ID.
3. Enable RLS on every public table. Write explicit select/insert/update/delete policies; do not rely on defaults.
4. Permit `parse_drafts` insertion only through a later server path; this first migration may leave client insert denied.
5. Add SQL isolation tests covering: owner read/write succeeds; second user select/update/delete fails; an agent authorization cannot be created for a different user; a canonical event cannot use another user's raw log.
6. Apply the migration with the Supabase CLI and run the SQL tests against the local Supabase stack before applying to the hosted alpha project.
7. In the hosted dashboard, confirm Auth email providers are invite-only and no public sign-up path is exposed.

**Acceptance criteria:**
- A clean local migration succeeds.
- RLS isolation tests pass for two different authenticated user IDs.
- Hosted project has the same migration history.
- No client API policy permits cross-user data access.

## Phase 2 — Invite-only authentication and web storage migration

**Objective:** Replace anonymous local persistence with an authenticated, per-user Supabase adapter without changing the approved dark UI direction.

**Files:**
- Create: `src/lib/supabase.ts`
- Create: `src/auth/AuthGate.tsx`
- Create: `src/storage/supabaseStorageAdapter.ts`
- Modify: `src/App.tsx`, `src/main.tsx`, `src/state/store.ts`
- Test: `src/auth/AuthGate.test.tsx`, `src/storage/supabaseStorageAdapter.test.ts`

**Steps:**
1. Create a single typed browser client that fails clearly when public environment configuration is absent.
2. Add magic-link/invite session handling, signed-in identity display, and sign-out.
3. Keep the current local adapter only as a development/test fixture; production app data loads through the Supabase adapter.
4. Persist raw logs before any parse request; render clear network/error/retry states.
5. Add a one-time, explicit user migration/export decision for existing local prototype data. Do not silently upload it.
6. Test signed-out blocking, session restoration, owner-only CRUD calls, and failed network behavior.

**Acceptance criteria:** an invited user signs in, logs out, returns, and sees only their own persisted records.

## Phase 3 — Optional server-side LLM drafting (deferred)

**Decision:** Start the alpha with raw-note MCP context and no separate AGym parsing-model calls. Raw text remains the durable source evidence and is returned explicitly as unparsed self-report. Introduce this phase only if real usage shows that raw context is insufficient.

**Future objective:** Convert a user-selected raw text note into a schema-validated, visibly uncertain cached draft while preserving the raw input and keeping secrets server-only.

**Future steps:**
1. Establish a server-only endpoint/function that authenticates the user and writes `parse_drafts` only on an explicit user/agent request.
2. Record parser/model version, field-level confidence, safety flags, and parse status.
3. Validate model output with Zod before storage; a bad response creates a failed/partial draft, never invented fields.
4. Make confirmation a user-authenticated action that creates a `canonical_events` row; it does not overwrite the draft.
5. Require a dedicated LLM-processing consent record before sending raw text to a third-party model.
6. Add fixtures for ambiguity, pain/injury, extreme dieting, and malformed model output.

## Phase 4 — Plans and standard MCP/Hermes loop

**Objective:** Let Hermes read grounded context and write a proposed plan only after explicit user authorization.

**Steps:**
1. Add a web plan view distinguishing plans from confirmed outcomes.
2. Build a local stdio TypeScript MCP server using the standard protocol and an AGym user-scoped credential/configuration boundary.
3. Provide narrow tools: `get_context` (bounded confirmed outcomes plus clearly labelled raw notes), `list_plans`, `create_proposed_plan`, and `list_confirmed_outcomes`. No LLM is called by the raw-context tool.
4. Before `create_proposed_plan`, require an active `agent_authorizations` record matching client/action/scope; append `agent_audit_log` after every MCP read/write.
5. Configure Hermes as the first MCP client and verify tool discovery.
6. Run the founder proof: authorized Hermes plan → web plan display → user raw log → Hermes reads bounded raw/confirmed context. Add the optional draft/confirmation path only when the deferred Phase 3 is activated.

## Phase 5 — Private alpha operations

1. Invite a small named tester cohort; no open registration.
2. Verify export and deletion for a test account before collecting real logs.
3. Monitor parser corrections and authorization/audit data without using sensitive logs for model training.
4. Add testers only through a deliberate founder decision and Supabase Auth invitation.

## Sequencing and rollback

- Complete and review each phase before the next; no MCP or LLM provider integration before Phase 1 proves RLS.
- Keep the local prototype usable until Phase 2 has passed a real authentication/persistence smoke test.
- If a hosted migration fails, restore from Supabase backups/history and fix with a new forward migration; never edit an applied migration.
- If an agent integration is unsafe or ambiguous, revoke its authorization and disable MCP writes while retaining user-readable audit records.
