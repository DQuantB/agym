# AGym

AGym is an AI-native fitness and health data-layer project.

It is not primarily an AI coach app. Users already use AI assistants, human coaches, spreadsheets, and fitness apps for guidance; the missing layer is a user-owned loop that lets agents write plans into tools and read back what actually happened.

## Canonical loop

```text
agent plan → user action → raw log → parsed event → user correction → canonical memory → Coach Briefing/API context → next plan
```

## MVP vertical slice

The first MVP is the Unstructured Logger + Coach Briefing Generator:

```text
raw text log → parsed JSON → editable preview → user confirmation → canonical event saved locally → Coach Briefing markdown → JSON export
```

The MVP should prove that messy real-world fitness/health behavior can become agent-readable, user-confirmed memory without pretending to be a full coach or medical product.

## Source of truth

Start here:

- Product scope: `docs/product/mvp.md`
- Data model: `docs/architecture/data-model.md`
- Parser/eval examples: `docs/evals/sample-logs.md`
- Coach Briefing format: `docs/product/coach-briefing.md`
- Implementation plan: `docs/plans/mvp-implementation-plan.md`
- GitHub issue plan: `docs/plans/github-issues.md`
- Initial MVP decision: `docs/decisions/0001-initial-mvp-scope.md`

## Privacy stance

For v0, AGym is local-first.

- Raw user input must be preserved.
- User-confirmed canonical events must remain exportable.
- Export/delete must be available before the MVP is considered complete.
- No opaque resale of user data.
- Research, model training, fine-tuning, sharing, or external sync requires explicit consent and is out of scope for v0.

## Medical and safety stance

AGym stores and summarizes self-reported log data. It does not diagnose, treat, prescribe, or provide medical advice.

Pain, injury, extreme dieting, eating-disorder-like signals, or other safety-sensitive inputs must be represented carefully and routed to human/specialist review language rather than automated medical claims.

## Non-goals for v0

Do not build these in the first MVP:

- full AI coach;
- medical diagnosis, treatment, or clinical claims;
- native mobile app;
- wearable integrations;
- trainer dashboard;
- full auth;
- full backend;
- payments;
- production deployment;
- public launch;
- proprietary model;
- recommendation engine;
- analytics dashboards;
- social/community features;
- API/MCP endpoint;
- import from third-party fitness apps;
- paid APIs without explicit approval.

## Development status

Implementation has not been scaffolded yet. The current repository contains the initial product and engineering specs imported from the AGym Fable planning pass.

Dev setup commands will be added when the Vite/React app is scaffolded in issue #3.

Follow `AGENTS.md` and `CONTRIBUTING.md` when using coding agents.
