# ADR 0002 — Networked Agent Alpha Supersedes Local-Only MVP Closure

Status: accepted
Date: 2026-07-13
Supersedes: ADR 0001 only for post-v0 product work

## Decision

The shipped local-first application is a technical prototype of the confirmable outcome loop, not a viable product MVP. AGym now proceeds as a **networked agent alpha**:

```text
agent-written plan → AGym plan view → user action → raw outcome log → LLM draft → user correction/confirmation → canonical outcome → agent-readable context
```

The first agent client is **Hermes**, using a standard-MCP-compatible server so future clients are not structurally excluded.

## Why

Rule-based browser parsing cannot support the variety of real fitness logs. Local-only storage and export do not create the persistent bidirectional context layer required by AGym. The product needs three connected capabilities: hosted user-scoped memory, LLM-assisted structured drafting with explicit uncertainty, and an agent interface that can read outcomes and write proposed plans.

## Alpha scope

1. Supabase Auth plus Postgres with row-level security; browser application uses only the publishable/anon key.
2. Persist raw logs, LLM parse drafts, user-confirmed canonical outcomes, agent-written plans, plan items, and an auditable provenance/authorization record.
3. Replace `mockParser` in the hosted path with a server-side LLM parsing boundary that validates structured output, preserves raw input, records model/parser version, and falls back safely to a draft/note rather than fabricating facts.
4. Add a plan view in the web app that visibly distinguishes `agent_written_plan` from completed outcomes.
5. Deliver a local stdio MCP server for Hermes. Initial tools: read current context, list plans, write a proposed plan after explicit conversation authorization, and read confirmed outcomes. No silent outcome confirmation and no medical advice.

## Non-goals for the first networked alpha

- native mobile app;
- wearable integrations;
- multi-user sharing, trainer dashboard, payments, or public launch;
- autonomous plan execution;
- agent ability to mark outcomes as user-confirmed;
- medical diagnosis, treatment, or risk scoring;
- placing Supabase service-role or LLM-provider secrets in the browser or an MCP client.

## Required gates

- Supabase project credentials and local-development configuration are supplied without committing secrets.
- Database migrations, RLS policy tests, and tenant-isolation tests pass before hosted health data is used.
- Every MCP write has a user identity, provenance, source client, timestamp, and explicit authorization record.
- The plan/outcome distinction is shown in the UI and retained in export/context.
- Hermes end-to-end test proves: authorized plan write → web plan display → user-confirmed outcome → MCP context read.

## Transition

ADR 0001 remains historical truth for the shipped local-first prototype. Any source document saying backend, auth, LLM parsing, or MCP is out of scope applies only to that archived v0 slice and must not block this alpha.
