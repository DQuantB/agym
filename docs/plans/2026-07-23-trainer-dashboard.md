# Trainer Dashboard Implementation Plan

> **For Hermes:** implement one ticket per clean branch/worktree using `subagent-driven-development`; run a specification review, then a code-quality review, before moving to the next ticket.

**Status:** proposed. This is post-alpha product work; it does not authorize production access to real client health data.

**Goal:** let an invited trainer sign in to a dedicated web workspace, see only clients who have explicitly and revocably shared a narrow data scope, and read a per-client weekly briefing without gaining direct access to the client’s raw health log.

**Architecture:** Keep Supabase Auth/Postgres/RLS as the trust boundary. A trainer is an authenticated AGym account with a trainer profile, not a browser-held service-role key. Client-to-trainer sharing is a first-class, client-controlled grant with a narrow scope, an effective date, revocation, deletion cascade, and a user-visible access audit. The browser calls narrow authenticated RPCs/views; it must never query another user’s base `raw_logs`, `parse_drafts`, `canonical_events`, or `plans` tables directly.

**Tech stack:** existing Vite + React + TypeScript app, Supabase Auth/Postgres/RLS/RPC, Vitest, SQL RLS regression scripts, Vercel. No new paid provider, analytics platform, email service, or LLM dependency in the first release.

---

## 1. Source-of-truth and product decision

ADR 0002 explicitly makes multi-user sharing and a trainer dashboard non-goals for the first networked alpha. This plan therefore starts with a new ADR that supersedes that non-goal only for the bounded trainer-sharing product. `docs/architecture/data-model.md` is useful future-schema input, not an implementation contract.

### First release: roster-lite, not a broad dashboard

A trainer can:

1. sign in to a trainer workspace;
2. create a time-limited connection invitation;
3. see a list of active, consenting clients;
4. see each client’s display name, timezone, last *shared activity* date, and a deterministic recency state;
5. open a weekly briefing containing only the scope the client granted; and
6. see that access has been revoked or a client has deleted their account.

The client can:

1. view the trainer identity and exact scope before accepting;
2. accept or decline a pending invitation;
3. view current and past grants, their start/end dates, and trainer reads;
4. revoke immediately, without trainer approval; and
5. export/delete their account as before. Deletion removes all grants, invitations, and trainer-visible data by cascade.

### Explicit non-goals for release 1

- no direct trainer access to raw logs, parse drafts, raw JSON, chat, notes, photos, or audio;
- no client-plan write, plan approval, exercise prescription, medical triage, diagnosis, or automated recommendation;
- no cross-client analytics, leaderboards, benchmarks, ranking, bulk export, billing, scheduling, messaging, or email digest;
- no public trainer directory, self-service public registration, organisations/multi-trainer teams, or delegated staff;
- no implicit historical sharing: default visibility begins at the accepted grant timestamp;
- no use of client data for model training, advertising, or external analytics.

The UI must call the roster signal **recent shared activity**, not adherence/health/risk. Its state is a transparent date threshold, never a judgement about compliance or medical status.

---

## 2. Product and privacy contract (must be approved before coding)

### Roles

| Role | Identity | First-release permission |
|---|---|---|
| Client | existing authenticated AGym user | owns data; creates/revokes trainer grants |
| Trainer | existing invited authenticated AGym user with a trainer profile | reads only data exposed by an active client grant |
| Platform admin/service role | server-only operational identity | invite provisioning/migration operations only; never in browser |

A person may technically have both profiles in the database, but the UI must make them choose a workspace and must not mix client data with trainer data in one query/cache.

### Share scopes

Use an explicit enum/set rather than a boolean “share with trainer” switch:

- `roster_activity`: display name, timezone, last shared activity date, deterministic recency state;
- `weekly_briefing_confirmed`: a generated briefing based on user-confirmed outcomes and accepted-plan/execution linkage after the grant start;
- `safety_flags`: separately optional; only a prominently labelled user-confirmed safety/restriction item, never an AGym diagnosis;
- `raw_evidence`: deliberately unsupported in release 1.

The acceptance UI must name the trainer, scopes, no-historical-default rule, and revoke effect. It must not preselect `safety_flags`. A grant gives no access until client acceptance.

### Recency state

Implement a documented, deterministic presentation value using the client timezone and the most recent **shareable** record created after `shared_from`:

- `recent`: activity within 7 calendar days;
- `needs_check_in`: activity 8–13 days ago;
- `not_recent`: no shareable activity for 14+ days or none since sharing began;
- `unknown`: data/query error; never render it as `not_recent`.

The response must include the threshold/version and latest date so the UI can explain it. This is an operational check-in cue, not “red/yellow/green adherence.”

---

## 3. Database and security design

### New database types/tables

Create a dated forward migration; never edit applied migrations.

```sql
create type public.trainer_share_scope as enum (
  'roster_activity',
  'weekly_briefing_confirmed',
  'safety_flags'
);

create type public.trainer_share_status as enum (
  'pending', 'active', 'declined', 'revoked', 'expired'
);

create table public.trainer_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trainer_client_shares (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainer_profiles(user_id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  status public.trainer_share_status not null default 'pending',
  scopes public.trainer_share_scope[] not null default '{}',
  shared_from timestamptz,
  accepted_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz not null,
  consent_version text not null,
  created_at timestamptz not null default now(),
  check ((status = 'active') = (accepted_at is not null and shared_from is not null)),
  check (trainer_id <> client_id)
);

create table public.trainer_access_audit_log (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  trainer_id uuid not null references public.trainer_profiles(user_id) on delete cascade,
  share_id uuid not null references public.trainer_client_shares(id) on delete cascade,
  action text not null check (action in ('read_roster', 'read_briefing')),
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);
```

Do not store an unprotected client email in a trainer-readable table. Invitation delivery is a separate operational decision; for the first private alpha, the client and trainer must already be invited AGym users.

### Invitation and consent lifecycle

1. Trainer creates a short-lived, random, one-time invitation via an authenticated `create_trainer_share_invitation` RPC. Store only a hash of the bearer secret; never log the secret.
2. The logged-in client opens the invitation route and sees trainer display name and requested scopes. The preview RPC returns no client data.
3. Client accepts through `accept_trainer_share_invitation`; the function derives `auth.uid()`, writes/activates only that client’s grant, sets `shared_from = now()`, and inserts an append-only `consent_records` record with newly-added `trainer_dashboard_sharing` consent type and a typed grant reference selected by the schema task below.
4. Client declines, revokes, or account-deletes through owner-scoped RPCs. Revocation immediately makes all trainer read RPCs return no client record; it must also clear the trainer browser's cached roster/briefing state before the revoked-state UI renders. AGym does not persist a trainer-side copy of a briefing in release 1, so there is no derived health-data cache to erase. A trainer may of course remember or manually copy information already read; the consent copy must state that technical limit plainly.
5. The sole retained revocation evidence is a minimum, content-free grant/audit record (trainer ID, share ID, action, timestamp, and window/version—not raw content or briefing text), visible to the client and deleted with the client account. Source health records remain client-owned and are never deleted by revoking a share.
6. Scopes are immutable once accepted. To narrow, broaden, or renew access, the client revokes and accepts a fresh invitation with fresh consent copy. Expired invitations are unusable, and a trainer cannot reactivate a revoked share.

Before implementation, decide whether the existing `consent_records` schema gains a `subject_type`/`subject_id` column. Prefer a typed `trainer_share_id` foreign key instead of putting a critical grant ID in freeform `note`; make this a migration task with an ADR decision.

### RLS/RPC rules

1. Enable RLS on every new table and revoke `anon` privileges.
2. The client can select their own shares/audit records and invoke accept/decline/revoke functions only for their own identity.
3. The trainer can select their own trainer profile and invitation metadata, but does **not** receive a direct `SELECT` policy over client-owned health tables.
4. Expose trainer data only through narrow `SECURITY DEFINER`, fixed-`search_path` RPCs that call `auth.uid()`, verify an active grant and scope, enforce `shared_from`, return a fixed allow-list of columns, and append an audit record atomically.
5. Never trust a `client_id`, `trainer_id`, scope, or timestamp supplied by the browser for authorization.
6. The trainer cannot create, update, delete, confirm, parse, or otherwise mutate any client event in release 1.
7. A client can view each access audit row. The trainer may view only their own action metadata, not client audit history beyond their own reads.
8. Service-role access stays confined to server/CLI functions. Neither source nor public environment files contain it.

### Narrow read contracts

`list_my_trainer_roster()` returns only:

```ts
type TrainerRosterRow = {
  shareId: string;
  clientDisplayName: string;
  clientTimezone: string;
  sharedFrom: string;
  lastSharedActivityDate: string | null;
  recency: 'recent' | 'needs_check_in' | 'not_recent' | 'unknown';
  recencyPolicyVersion: 'v1';
};
```

`get_shared_weekly_briefing(p_share_id, p_week_start)` verifies scope and returns a generated, versioned document with: confirmed outcomes in the permitted window, accepted-plan/execution linkage where present, provenance labels, source window, disclaimer, and optional scope-approved safety/restriction banner. It returns no raw log text or uncertain draft fields.

Do not persist a briefing cache in release 1 unless performance evidence requires it. Generate from a deterministic query/helper, test with fixtures, and add caching later only with source IDs/window/version/invalidation rules.

---

## 4. Web information architecture

Use one Vite deployment and existing Supabase auth, with an explicit workspace route rather than a separate application initially.

- `/trainer` — trainer route guard; roster; sign-out.
- `/trainer/connect` — create/rotate invitation; no client data.
- `/trainer/client/:shareId` — client heading, recency explanation, week selector, briefing document.
- `/share/trainer/:token` — authenticated client accepts/declines a pending invitation; no trainer data other than identity/scopes.
- `/data/sharing` — client’s active/past trainer shares, scope copy, revoke control, and trainer-access history.

Route guards determine identity from a trainer profile using an owner-scoped RPC, not mutable user metadata. Cache/query keys always include authenticated user ID and are cleared synchronously on auth state change/sign-out.

UI language requirements:

- show provenance (`user confirmed`, `agent-written plan`) rather than flattening data;
- show “not medical advice” on shared briefings;
- present safety/restriction material as user-confirmed/shared information, not diagnosis or a recommendation;
- show `unknown` error state instead of stale roster data;
- make revocation obvious and confirm destructive action;
- keyboard-accessible, phone-safe client share acceptance and desktop-first trainer workspace.

---

## 5. Delivery sequence and gates

### Gate 0 — validate the coach value before code

**Owner:** founder.

1. Create five manually-generated, de-identified or synthetic weekly briefings using the existing briefing format.
2. Show them to 5–10 real trainers/coaches.
3. Record: “Would you use this weekly?” and “What would it be worth per active client?” plus what data they actually need.
4. Do not collect real client data in AGym for this study without separate participant consent.

**Exit criterion:** at least a founder-reviewed decision that the roster + briefing solves a real check-in workflow. If it fails, stop before schema/UI work.

### Task 1 — establish post-alpha authority and threat model

**Files:**
- Create: `docs/adr/0004-trainer-dashboard-sharing.md`
- Create: `docs/security/trainer-dashboard-threat-model.md`
- Modify: `docs/plans/2026-07-23-trainer-dashboard.md`

**Steps:** document the bounded release scope, consent model, raw-data exclusion, access-audit requirement, historical-data default, deletion behavior, and exact non-goals. Enumerate threats: guessed links, stale session/cache, client ID tampering, revoked share race, RLS recursion/bypass, service-role leakage, and unsafe medical interpretation.

**Verify:** founder accepts the ADR; no task below may change schema before this decision is committed.

### Task 2 — define database contract and fixtures

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_add_trainer_sharing.sql`
- Create: `supabase/tests/trainer-sharing.sql`
- Modify: `supabase/tests/account-deletion.sql`
- Modify: `docs/deploy/going-live.md`

**TDD/RLS cases:** owner can accept own invitation; a different client cannot accept it; trainer cannot self-create an active client share; expired/revoked grants fail; grant begins at acceptance; direct trainer selects on base client data fail; client can see their own grant/audit data; account deletion removes grants/audits/invitations.

**Verify:** fresh local Supabase reset and SQL test pass; inspect policies/grants; then prove hosted migration parity before applying to the mock hosted alpha.

### Task 3 — implement lifecycle RPCs and immutable consent/audit semantics

**Files:** same migration/test files as Task 2; create a focused SQL test if separation improves readability.

**TDD/RLS cases:** invitation token stored hashed; use consumes/invalidates it; accept writes the scoped active grant and consent record atomically; revoke is immediate and irreversible; a fresh invitation is required after revoke; all timestamps derive in the database.

**Verify:** SQL test proves no browser-supplied ID/scope can grant access; `git diff --check` and migration reset pass.

### Task 4 — implement roster and briefing read RPC contracts

**Files:**
- Modify: trainer-sharing migration or a new dated forward migration
- Create: `supabase/tests/trainer-roster-rpc.sql`
- Create: `src/trainer/trainerContracts.ts`
- Create: `src/trainer/trainerContracts.test.ts`

**TDD cases:** active scoped trainer sees exactly one safe roster row; no grant/revoked/expired grant returns no row; last activity before `shared_from` is excluded; raw text/parse drafts are never in response; unknown/error is distinct; briefing excludes uncertain drafts and pre-grant records; `safety_flags` output requires that explicit scope; each successful read appends one audit row.

**Verify:** SQL RPC suite and TypeScript contract tests pass; use fixture data for client A/client B/trainer/other trainer.

### Task 5 — add client sharing controls before trainer UI

**Files:**
- Create: `src/sharing/TrainerShareAcceptView.tsx`
- Create: `src/sharing/TrainerSharingSettingsView.tsx`
- Create: `src/sharing/trainerSharingApi.ts`
- Create: colocated Vitest tests
- Modify: `src/main.tsx`, auth navigation, styles

**Behavior:** signed-in client can preview identity/scopes, accept/decline, view active scope/start date/access history, and revoke. The view makes clear that raw logs are not shared in release 1.

**Verify:** component states for loading/error/invalid token/accept/revoke; account switch clears all share state; no UI bypasses RPCs or writes tables directly.

### Task 6 — add trainer identity and workspace route guard

**Files:**
- Create: `src/trainer/TrainerGate.tsx`
- Create: `src/trainer/trainerApi.ts`
- Create: `src/trainer/TrainerGate.test.tsx`
- Modify: `src/main.tsx`, `src/auth/AuthGate.tsx`

**Behavior:** existing invited account may complete minimal trainer profile only through protected flow. `/trainer` denies ordinary clients; a dual-role account chooses a workspace; sign-out/account change clears trainer cache.

**Verify:** route and auth-state tests; browser uses only publishable key; trainer profile cannot be spoofed via client metadata.

### Task 7 — build roster-lite

**Files:**
- Create: `src/trainer/TrainerRosterView.tsx`
- Create: `src/trainer/TrainerRosterView.test.tsx`
- Modify: `src/trainer/trainerApi.ts`, application styles

**Behavior:** render loading, empty, error, and roster states. Each client row displays name, timezone, last shared activity, explained recency label, and “Open briefing.” No charts, ranking, raw activity feed, export, or bulk action.

**Verify:** unit/component tests cover all four recency values and a revoked share disappearing after refresh; manual keyboard and narrow-screen check.

### Task 8 — build client briefing document view

**Files:**
- Create: `src/trainer/TrainerClientBriefingView.tsx`
- Create: `src/trainer/TrainerClientBriefingView.test.tsx`
- Modify: `src/trainer/trainerApi.ts`

**Behavior:** week selection, data-window/provenance/disclaimer display, safe empty state, optional explicitly shared safety banner, and stale/revoked access handling. Copy-to-clipboard is deferred unless the user story proves it; do not add email.

**Verify:** tests assert uncertain/raw fields never render and revoked access does not leave cached briefing text visible.

### Task 9 — audit, export/delete, and real two-account proof

**Files:**
- Modify: `src/sharing/TrainerSharingSettingsView.tsx`
- Modify: `src/storage/supabaseStorageAdapter.ts` or dedicated export module only if current export needs extension
- Create: `docs/operations/trainer-sharing-validation.md`
- Modify: account-deletion tests/docs

**Required manual proof:** trainer and two client accounts; invite → preview → accept → roster → briefing → audit entry → revoke while trainer page is open → no further data after refresh → delete client → no roster record. Record only build IDs/test accounts, never tokens or health details.

**Verify:** RLS SQL suite, web tests, typecheck, lint, build, hosted migration parity, and the written manual proof all pass.

### Task 10 — private-alpha release decision

**Files:**
- Create: `docs/operations/trainer-dashboard-release-checklist.md`
- Modify: `docs/deploy/going-live.md`

**Required review:** consent copy, privacy policy/data-processing implications, support/revocation procedure, incident response for unintended access, retention policy, accessibility, data export/deletion behavior, and the Gate 0 coach interview result. External trainer accounts are not invited until the founder accepts this checklist.

---

## 6. Acceptance criteria for the first trainer release

1. A trainer cannot see any client until that client accepts a specific, unexpired invitation.
2. A trainer can see only a fixed roster summary and explicitly scoped briefing—not raw data or uncertain drafts.
3. Revocation is immediate for new reads and subsequent refreshes, requires no trainer action, and is visible to the client.
4. Every trainer read is auditable to the client.
5. Existing client RLS remains intact: trainer identity cannot read base client tables through direct browser queries.
6. Client account deletion removes the trainer relationship and all client-scoped trainer audit data.
7. The system makes no clinical/medical claim and does not advise a trainer how to treat pain, injury, or eating-disorder-like signals.
8. The complete two-account/device/browser test is recorded before inviting any external trainer.

## 7. Future decisions, deliberately not pre-built

Only after release-1 adoption should AGym consider trainer-authored plans, trainer notes, organisations, team permissions, messaging, weekly email, billing, raw-evidence access, wearable imports, analytics, or clinical/specialist workflows. Each needs a separate ADR, scoped consent, provenance/audit model, RLS proof, and user testing; none is an extension of a generic `trainer` role.
