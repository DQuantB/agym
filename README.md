# AGym

AGym is an AI-native fitness and health data-layer project.

It is not primarily an AI coach app. The first product thesis is that users already use AI assistants, human coaches, spreadsheets, and fitness apps for guidance; the missing layer is a user-owned loop that lets agents write plans into tools and read back what actually happened.

Core loop:

```text
agent plan → user action → raw log → parsed event → user correction → canonical memory → Coach Briefing/API context → next plan
```

## MVP

The first MVP is the Unstructured Logger + Coach Briefing Generator:

```text
raw text log → parsed JSON → editable preview → user confirmation → canonical event saved locally → Coach Briefing markdown → JSON export
```

## Source of truth

Start here:

- Product scope: `docs/product/mvp.md`
- Data model: `docs/architecture/data-model.md`
- Parser/eval examples: `docs/evals/sample-logs.md`
- Coach Briefing format: `docs/product/coach-briefing.md`
- Implementation plan: `docs/plans/mvp-implementation-plan.md`
- GitHub issue plan: `docs/plans/github-issues.md`

## Non-goals for v0

- No full AI coach.
- No medical diagnosis or treatment claims.
- No native mobile app yet.
- No wearable integrations yet.
- No trainer dashboard yet.
- No production backend/auth until needed.
- No paid APIs or deployment without explicit approval.

## Development

Implementation has not been scaffolded yet. The current repository contains the initial product and engineering specs imported from the AGym Fable planning pass.

Follow `AGENTS.md` when using coding agents.
