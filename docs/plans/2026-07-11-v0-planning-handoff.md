# AGym v0 Planning Handoff — 2026-07-11

Status: planning baseline complete and pushed to GitHub `main`.

Latest confirmed git state:

```text
## main...origin/main
aa986ba docs: finalize v0 planning consistency
1fbe3d5 docs: establish v0 source-of-truth precedence, schema deltas, and agent-proof tickets
3e66cff docs: complete project charter and repo conventions (#19)
b22109a docs: initialize AGym repository from Fable outputs
```

## What happened

We used extended Fable 5 time for high-leverage planning and review, not routine coding.

The main planning problem discovered was that the repo contained two conflicting MVPs:

1. Future/backend product architecture: Supabase, auth, RLS, normalized tables, API endpoints, LLM parser, plan intake, consent/audit machinery.
2. Actual v0 implementation target: local-first Vite/React app with localStorage, deterministic mock parser, user correction, canonical events, and generated briefing/export.

We resolved that conflict before coding so future coding agents do not accidentally build the backend version.

## Files created or materially changed

Authoritative / new docs:

- `docs/adr/0001-v0-source-of-truth.md`
- `docs/architecture/v0-schema-deltas.md`
- `docs/plans/tickets-03-06.md`
- `docs/evals/parser-fixtures-v0.md`
- `docs/plans/tickets-09-10.md`
- `docs/briefing/coach-briefing-v0-standard.md`
- `docs/plans/tickets-15-16.md`
- `docs/plans/2026-07-11-v0-planning-handoff.md`

Patched/reference docs:

- `AGENTS.md`
- `README.md`
- `docs/plans/fable-import-notes.md`
- `docs/plans/github-issues.md`
- `docs/plans/mvp-implementation-plan.md`
- `docs/architecture/data-model.md`
- `docs/product/coach-briefing.md`
- `docs/product/mvp.md`

## Source-of-truth precedence chosen

For v0 implementation, use this order:

1. `docs/adr/0001-v0-source-of-truth.md`
2. `docs/plans/mvp-implementation-plan.md`
3. `docs/architecture/v0-schema-deltas.md`
4. `docs/plans/github-issues.md`
5. Expanded ticket docs:
   - `docs/plans/tickets-03-06.md`
   - `docs/plans/tickets-09-10.md`
   - `docs/plans/tickets-15-16.md`
6. Standards/evals:
   - `docs/evals/parser-fixtures-v0.md`
   - `docs/briefing/coach-briefing-v0-standard.md`

Reference/future docs lose on conflict:

- `docs/product/mvp.md`
- `docs/architecture/data-model.md`
- `docs/product/coach-briefing.md`
- `docs/evals/sample-logs.md`

## Final v0 product definition

AGym v0 is a local-first personal fitness data loop for agents.

It is not an AI coach.

Core loop:

```text
raw user log
→ deterministic parser draft
→ user correction / confirmation
→ canonical local event
→ generated Coach Briefing markdown
→ JSON export
```

Primary user value:

- The user can paste messy fitness logs.
- AGym preserves the raw text.
- AGym creates editable structured drafts.
- The user confirms/corrects them.
- AGym stores user-confirmed canonical events locally.
- AGym generates a clean briefing that can be handed to ChatGPT/Claude/another coach agent.

## Hard v0 non-goals

Do not build in v0:

- backend
- auth/accounts
- Supabase
- RLS
- API routes
- plan intake
- LLM parser
- wearables
- dashboards
- trainer dashboard
- native mobile app
- deployment
- payments
- social/community features
- medical diagnosis, treatment, or clinical claims
- AGym-authored coaching/recommendations

## Stack chosen

Implementation target:

- Vite
- React
- TypeScript
- Zod
- Zustand
- Vitest
- localStorage behind an async storage adapter

Important implementation constraints:

- strict TypeScript
- pure domain logic outside React
- no Tailwind
- no UI kit unless explicitly approved
- no router
- no backend/network calls
- one issue per branch/PR
- green CI required

## Schema specifics chosen

Payload kinds:

- `workout`
- `meal`
- `bodyweight`
- `sleep`
- `pain`
- `note`

Important schema decisions:

- v0 does not use `occurredAt`.
- v0 uses:
  - `date: YYYY-MM-DD`
  - `time: HH:mm | null`
- `pain` is a first-class payload kind.
- `parserVersion` is required on draft/canonical events.
- `provenance: "user_confirmed"` is required on canonical events.
- `originalPayload` is stored on canonical events so parser corrections are not lost.
- `schemaVersion: 1` is used for v0 records.
- `sourceText` must be preserved.
- `uncertaintyFlags` must make low-confidence fields visible.

Pain payload chosen:

```ts
{
  kind: "pain";
  bodyPart: string | null;
  description: string;
  severity: number | null;
  notes: string | null;
}
```

Pain constraints:

- severity only if user-stated
- no diagnosis
- no treatment suggestions
- no inferred cause
- no risk score
- no medical advice
- pain/discomfort is surfaced prominently in briefings

## Parser specifics chosen

Parser is deterministic and intentionally dumb for v0.

Rules:

- never throw
- never silently drop text
- unparseable segments become `note`
- pain/discomfort/injury language becomes `pain`
- nutrition values are user-stated only; never computed
- exercise names are as logged; no normalization
- lbs-to-kg conversion is allowed only with uncertainty flag
- relative dates resolve from a provided `defaultDate`
- ambiguous dates/times create uncertainty flags
- `time` is null unless explicitly stated
- parser output must include `parserVersion`, `sourceText`, and `uncertaintyFlags`

Fixture strategy:

- `docs/evals/parser-fixtures-v0.md` contains 25 parser fixtures, PF-001 through PF-025.
- Fixture checks should be invariant-based, not deep-equal golden JSON snapshots.
- Do not assert generated IDs.
- Do not assert exact uncertainty wording unless the category matters.
- Always assert that no text was silently dropped.

## Coach Briefing specifics chosen

Authoritative standard:

- `docs/briefing/coach-briefing-v0-standard.md`

Input:

```ts
CanonicalEvent[] + { from: YYYY-MM-DD, to: YYYY-MM-DD, generatedAt }
```

Output:

```ts
markdown string
```

Rules:

- generated on demand
- never stored
- user-confirmed log data only
- fixed disclaimer: `User-reported log data only. Not medical advice.`
- pain/discomfort section near the top
- raw user text must be quoted or clearly marked
- no recommendations
- no prescriptions
- no diagnosis
- no treatment suggestions
- no risk scores
- no nutrition calculations
- no exercise normalization
- no invented averages over missing days

Required sections:

1. Title / period
2. Disclaimer
3. Summary
4. Pain / discomfort
5. Training
6. Nutrition
7. Bodyweight
8. Sleep
9. Notes
10. Data quality
11. Export metadata

## Storage / privacy specifics chosen

v0 storage:

- browser localStorage
- plaintext
- local to this browser
- not guaranteed durable

Rules:

- raw logs are immutable except delete-all
- deleting a canonical event does not delete the raw log
- delete-all deletes raw logs, drafts, canonical events, and quarantine data
- Data panel should nudge export backups
- app should attempt `navigator.storage.persist()` where appropriate
- exported JSON should re-validate against schemas

## Expanded tickets created

Expanded agent-proof tickets:

- Issues 3–6: `docs/plans/tickets-03-06.md`
- Issues 9–10: `docs/plans/tickets-09-10.md`
- Issues 15–16: `docs/plans/tickets-15-16.md`

Original issue summaries in `docs/plans/github-issues.md` now point to these expanded tickets.

## Next step tomorrow

Review the MVP specifics one more time, especially:

- source-of-truth precedence
- schema decisions
- pain handling
- parser fixture behavior
- Coach Briefing standard
- storage/privacy language
- first implementation issue scope

If still satisfied, start coding with Issue 3 only.

Implementation instruction:

```text
Implement Issue 3 exactly from docs/plans/tickets-03-06.md.
Do not implement tabs, schemas, parser, storage, or UI behavior beyond the minimal AGym heading.
Verify npm ci, npm run lint, npm run typecheck, npm run test:run, and npm run build.
```

Do not start with schemas/parser/briefing. First establish the clean scaffold and scripts.
