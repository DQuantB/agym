# AGym Agent Operating System

This folder defines the first AGym company agents used to move work forward without the founder checking every intermediate output.

## Agents

1. `marketing-agent.md` — coach-first demand validation, founder-reviewed outreach preparation, positioning, and qualitative evidence analysis.
2. `marketing-subagents.md` — bounded Coach ICP Researcher, Outreach Drafter, Conversation Analyst, and Coach Demo/Positioning Writer contracts.
3. `product-builder-agent.md` — implementation agent for the AGym app, one GitHub issue / PR at a time.
4. `orchestrator-agent.md` — reviewer / chief-of-staff agent that assigns work, checks outputs against source-of-truth docs, runs verification gates, and prepares founder approval cards.

## Default toolsets

When running agents through Hermes, use the narrowest useful tool access:

- Marketing Agent: `file, web`; optionally `browser` for inspecting a founder-approved landing-page draft and `image_gen` for internal visual drafts. Marketing research never sends outreach or accesses private sources.
- Product Builder Agent: `file, terminal`; optionally `web` only for package documentation.
- Orchestrator Agent: `file, terminal, session_search`; optionally `web` for live external state.

If `image_gen` is unavailable, the Marketing Agent should report the configuration blocker and preserve prompts/mockups rather than claiming images were generated.

## Operating principle

The founder should approve strategy, public claims, spend, privacy-sensitive actions, and merges. Agents should handle drafts, implementation, checks, summaries, and evidence collection.

## Human-in-the-loop levels

- Level 0 — autonomous analysis/drafts/tests: agents may do freely.
- Level 1 — internal writes in repo/docs/Notion draft spaces: allowed if logged.
- Level 2 — review required before externalization: public copy, campaign assets, landing page changes, PRs.
- Level 3 — explicit founder approval required: ad spend, publishing campaign, collecting real emails, privacy-policy changes, GitHub merges, production deploys.
- Level 4 — forbidden/manual-only for now: medical claims, selling/sharing user data, autonomous emails to users, changing pricing/privacy promises, destructive repo actions.

## Current source-of-truth stack

For product implementation:

1. `docs/adr/0001-v0-source-of-truth.md`
2. `docs/plans/2026-07-11-v0-planning-handoff.md`
3. `docs/plans/mvp-implementation-plan.md`
4. `docs/architecture/v0-schema-deltas.md`
5. `docs/plans/tickets-03-06.md`
6. `docs/plans/github-issues.md`

For marketing and GTM:

1. `docs/agents/marketing-agent.md`
2. `docs/agents/marketing-subagents.md`
3. `docs/marketing/README.md` — durable marketing memory, activity log, and asset naming/status rules.
4. Active experiment briefs under `docs/marketing/experiments/`, beginning with `2026-08-01-coach-discovery-sprint-v1.md`.
5. `docs/marketing/brand-system.md` — active visual and voice system when creating visual work.
6. Historical consumer/waitlist campaign handoffs, which are not evidence for the coach-first wedge.
7. Product positioning in `docs/plans/2026-07-11-v0-planning-handoff.md`.

## Minimum workflow

1. Founder drops a goal into the Orchestrator.
2. Orchestrator turns it into one bounded task for Marketing or Product Builder.
3. Worker agent produces an artifact plus evidence.
4. Orchestrator reviews against constraints, source docs, and verification gates.
5. Orchestrator prepares a founder approval card.
6. Founder approves, rejects, or redirects.

No worker agent should publish, spend money, merge code, deploy, or contact users without explicit founder approval.
