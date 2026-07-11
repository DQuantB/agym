# ADR 0001 — v0 Source of Truth: Local-First Implementation Plan

Status: accepted
Date: 2026-07-11
Related: `docs/decisions/0001-initial-mvp-scope.md` (scope decision; this ADR resolves doc precedence)

## Problem

The imported planning docs describe two different systems. `docs/product/mvp.md` and
`docs/architecture/data-model.md` describe a future backend product (Supabase, auth, RLS,
18 normalized tables, LLM parser, plan intake, API endpoints) and label most of it "MVP".
`docs/plans/mvp-implementation-plan.md` describes the actual v0: a local-first browser app.
A coding agent reading `docs/` without this ADR will build the wrong system.

## Decision

For AGym v0:

1. **`docs/plans/mvp-implementation-plan.md` is AUTHORITATIVE**, as amended by
   `docs/architecture/v0-schema-deltas.md` (the deltas win over the plan where they differ).
2. **`docs/plans/github-issues.md` is the execution breakdown** of that plan.
3. These are **reference/target-state docs only** — they apply only where they do not
   conflict with the implementation plan:
   - `docs/product/mvp.md` (product loop spec)
   - `docs/evals/sample-logs.md` (eval dataset — still binding for parser behavior/values)
   - `docs/architecture/data-model.md` (future Postgres schema — NOT the v0 data model)
   - `docs/product/coach-briefing.md` (briefing templates)
4. **On any conflict, the local-first v0 plan wins.** "MVP" labels inside reference docs
   do not override this ADR.

## What v0 means — hard constraints

v0 is a single-user, local-first Vite + React + TypeScript app:
raw text log → mock parser → editable preview → user confirmation → canonical event in
localStorage → Coach Briefing markdown → JSON export.

v0 explicitly has:

- **no backend** (no API routes, no server, no deploy)
- **no auth** and no accounts
- **no Supabase**
- **no RLS**
- **no normalized Postgres tables** (the v0 data model is the flat Zod event union in the
  implementation plan §4 + schema deltas, not `data-model.md`'s 18 objects)
- **no LLM parser** (mock rule-based parser only; the `Parser` interface is the seam)
- **no plan intake** (Stage 1 of the loop is deferred; no `plan`/`plan_item` objects)
- **no wearables** or device imports
- **no dashboards**, charts, or analytics
- **no medical advice**, diagnosis, treatment recommendations, or health-risk claims

If an issue, doc section, or prompt appears to require any of the above for v0, stop and
flag it instead of building it.
