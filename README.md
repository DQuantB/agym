# AGym

AGym is an AI-native fitness and health data-layer project.

It is not primarily an AI coach app. Users already use AI assistants, human coaches, spreadsheets, and fitness apps for guidance; the missing layer is a user-owned loop that lets agents write plans into tools and read back what actually happened.

## Canonical loop

```text
agent plan → user action → raw log → parsed event → user correction → canonical memory → Coach Briefing/API context → next plan
```

## Current status (2026-08-04)

The sections below describe the original v0/MVP slice and are kept as historical record — the project has since moved through several phases. Read `docs/adr/0001-v0-source-of-truth.md` through `docs/adr/0005-coach-linking-and-monetization-phase.md` for what actually changed and why. In short: AGym now has a hosted Supabase backend (auth + RLS), a shipped native mobile app with multiple TestFlight builds, remote MCP endpoints, and in-progress coach-linking, a coach web dashboard, and monetization scaffolding (ADR 0005). The "Non-goals for v0" list below is no longer all accurate; see that ADR for which items it supersedes.

## MVP vertical slice (v0, historical)

The first MVP is the Unstructured Logger + Coach Briefing Generator:

```text
raw text log → parsed JSON → editable preview → user confirmation → canonical event saved locally → Coach Briefing markdown → JSON export
```

The MVP should prove that messy real-world fitness/health behavior can become agent-readable, user-confirmed memory without pretending to be a full coach or medical product.

## Source of truth

**Precedence rule (`docs/adr/0001-v0-source-of-truth.md`):** for v0, `docs/plans/mvp-implementation-plan.md` + `docs/architecture/v0-schema-deltas.md` are authoritative; everything else is reference and loses on conflict. `docs/product/mvp.md` and `docs/architecture/data-model.md` describe the future backend target, not what to build now.

Start here:

- **v0 precedence ADR: `docs/adr/0001-v0-source-of-truth.md`**
- **v0 schema deltas: `docs/architecture/v0-schema-deltas.md`**
- Product scope (reference): `docs/product/mvp.md`
- Future data model (reference): `docs/architecture/data-model.md`
- Parser/eval examples: `docs/evals/sample-logs.md`
- Coach Briefing format: `docs/product/coach-briefing.md`
- Implementation plan: `docs/plans/mvp-implementation-plan.md`
- GitHub issue plan: `docs/plans/github-issues.md`
- Initial MVP decision: `docs/decisions/0001-initial-mvp-scope.md`

## Privacy stance

For v0, AGym is local-first.

- v0 stores health/fitness data in browser localStorage: plaintext, unencrypted, and not guaranteed durable (browser eviction or "clear site data" destroys it). The app requests persistent storage where the browser supports it and nudges users to export backups.
- Raw user input is preserved before parsing.
- User-confirmed canonical events are exportable as a complete JSON file containing `schemaVersion`, `exportedAt`, `rawLogs`, and `events`.
- Delete-all wipes every `agym.*` localStorage key after typed confirmation plus a browser confirmation dialog.
- The v0 app has no backend, no accounts, no analytics, and no source-code network calls such as `fetch`.
- No opaque resale of user data.
- Research, model training, fine-tuning, sharing, or external sync requires explicit consent and is out of scope for v0.

## Medical and safety stance

AGym stores and summarizes self-reported log data. It does not diagnose, treat, prescribe, or provide medical advice.

Pain, injury, extreme dieting, eating-disorder-like signals, or other safety-sensitive inputs must be represented carefully and routed to human/specialist review language rather than automated medical claims.

## Non-goals for v0 (historical — see ADR 0002-0005 for what's since shipped or been superseded)

Original v0 non-goal list. Struck-through items have since shipped or been explicitly superseded; see the linked ADR.

- full AI coach — still a non-goal (no automated plan authorship or medical claims);
- medical diagnosis, treatment, or clinical claims — still a non-goal;
- ~~native mobile app~~ — shipped; see ADR 0004;
- wearable integrations — still a non-goal;
- ~~trainer dashboard~~ — superseded; see ADR 0005;
- ~~full auth~~ / ~~full backend~~ — shipped (Supabase auth + RLS); see ADR 0002;
- ~~payments~~ — monetization scaffolding superseded this; see ADR 0005 (no live payment processor yet);
- production deployment — the web app is deployed (`https://agym-murex.vercel.app`); a public launch is still a non-goal;
- public launch — still a non-goal;
- proprietary model — still a non-goal;
- recommendation engine — still a non-goal;
- analytics dashboards — still a non-goal;
- social/community features — still a non-goal;
- ~~API/MCP endpoint~~ — shipped; see ADR 0002-0004;
- import from third-party fitness apps — still a non-goal;
- paid APIs without explicit approval — still requires explicit approval.

## Development status

The local-first Vite/React MVP shell is scaffolded and implements the first vertical slice:

```text
raw text log → deterministic parsed draft → editable JSON preview → user confirmation → local canonical event → Coach Briefing markdown/JSON export
```

Run locally:

```bash
npm install
npm run dev
```

Quality checks:

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
```

Follow `AGENTS.md` and `CONTRIBUTING.md` when using coding agents.
