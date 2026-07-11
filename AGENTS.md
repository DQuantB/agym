# AGym Agent Instructions

## Project

AGym is an AI-native fitness/health data-layer product.

It is not primarily an AI coach app. It is a micro-app ecosystem that lets users capture messy health/fitness behavior and turn it into agent-readable, user-owned memory.

Core loop:

```text
agent plan → user action → raw log → parsed event → user correction → canonical memory → Coach Briefing/API context → next plan
```

First MVP: Unstructured Logger + Coach Briefing Generator.

## Non-negotiable product constraints

1. Every AGym micro-app must eventually let agents/LLMs write plans into the app.
2. Every AGym micro-app must eventually let agents/LLMs read real outcomes back from the app.
3. Preserve raw user input.
4. Do not flatten uncertainty into truth.
5. Distinguish raw self-report, LLM-parsed uncertain, user-confirmed, agent-written plan, human-specialist plan, imported-device, specialist-verified, derived metric, and AI hypothesis. (Product principle — **v0 implements only `provenance: "user_confirmed"`**; the full taxonomy is future schema, see `docs/architecture/v0-schema-deltas.md` §2.)
6. No medical diagnosis or treatment claims.
7. Pain/injury/extreme dieting/eating-disorder-like signals require caution and human/specialist review language.
8. User owns data. Export/delete must be supported.
9. No opaque resale. Research/model-training/fine-tuning use requires explicit consent.
10. Do not build a full AI coach in the MVP.

## Development rules

- Use TypeScript for app code.
- Prefer a simple, local-first implementation for v0.
- Avoid premature backend/platform abstractions.
- Keep changes small and PR-sized.
- Use branch-per-issue workflow.
- Do not commit secrets.
- Do not add paid APIs without explicit approval.
- Do not add production deployment without explicit approval.
- Do not change privacy positioning without explicit approval.

## Coding-agent workflow

For each task:

1. Read the relevant docs in `docs/`, starting with `docs/adr/0001-v0-source-of-truth.md` (doc precedence) — expanded tickets and the schema deltas win over older doc text.
2. Create or use a dedicated branch.
3. Make the smallest change that satisfies the issue.
4. Run relevant checks.
5. Commit with a clear message.
6. Open a PR when requested.
7. Include summary, tests run, risks, and follow-up tasks.

## MVP vertical slice

Build only:

```text
raw text log → parsed JSON → editable preview → user confirmation → canonical event saved locally → Coach Briefing markdown generated → JSON export available
```

Out of scope for first MVP:

- native mobile app;
- wearable integrations;
- trainer dashboard;
- full auth;
- full backend;
- payment;
- public launch;
- proprietary model;
- medical/clinical claims.
