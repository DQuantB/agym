# AGym Agent Operating Plan — 2026-07-11

## Objective

Create a small operating system of agents so the founder can offload execution while keeping approval over important decisions.

The first system has three roles:

1. Marketing Agent — creates and analyzes the waitlist smoke test.
2. Product Builder Agent — builds the AGym app one issue at a time.
3. Orchestrator Agent — assigns tasks, checks outputs, verifies evidence, and prepares approval cards.

## Why this structure

The founder should not need to continuously inspect every intermediate draft or code change.

But AGym is still early, privacy-sensitive, and health-adjacent. So agents need explicit boundaries:

- Workers can draft, build, and test.
- Orchestrator can review and recommend.
- Founder approves publishing, spend, data collection, merges, deploys, privacy changes, and strategy shifts.

## Initial workstreams

### Workstream A — Waitlist campaign

Owner: Marketing Agent
Reviewer: Orchestrator Agent
Founder approval required before public launch.

Goal:

Validate which AGym entry point has strongest demand:

1. Messy Log Cleaner
2. AI Plan Tracker
3. Coach Briefing Generator

Marketing Agent deliverables:

- one landing-page structure with all three interest tracks
- landing-page copy v1
- waitlist form questions
- ad/post variants
- image prompts
- 7-day launch plan
- metrics and decision rules

Orchestrator review gates:

- no medical/coaching overclaims
- no fake traction
- product capabilities match v0 or are clearly framed as interest tracks
- waitlist questions produce useful segmentation
- founder gets a clear approval card before publishing

### Workstream B — Product implementation

Owner: Product Builder Agent
Reviewer: Orchestrator Agent
Founder approval required before merge/deploy.

Goal:

Start with Issue 3 only from `docs/plans/tickets-03-06.md`.

Product Builder deliverables:

- branch for Issue 3
- Vite + React + TypeScript scaffold
- required scripts
- Vitest/jsdom smoke test
- placeholder module folders
- minimal `AGym` heading only
- README dev setup update
- exact verification command results

Required verification:

```bash
npm ci
npm run lint
npm run typecheck
npm run test:run
npm run build
```

Orchestrator review gates:

- scope limited to Issue 3
- no tabs/schemas/parser/storage/briefing yet
- no backend/auth/network calls
- no Tailwind/router/UI kit
- all commands pass
- clean PR summary and risks

## Practical execution model

For now, these agents can be used as prompt-backed roles in ChatGPT EDU, Hermes sessions, or external coding agents.

Recommended setup:

1. Create one ChatGPT EDU Project or chat for the Marketing Agent using `docs/agents/marketing-agent.md` as the system instructions.
2. Create one coding-agent prompt/session for Product Builder using `docs/agents/product-builder-agent.md` as the system instructions.
3. Keep this Hermes session, or a dedicated ChatGPT EDU Project, as Orchestrator using `docs/agents/orchestrator-agent.md`.

Do not attempt full automation immediately. Start with prompt-backed agents and manual approval. Add automation only after 2–3 successful cycles.

## First two tasks to run

### Task 1 — Marketing Agent

Prompt:

```text
Create the first 7-day waitlist smoke test for AGym using your system instructions.

Output the landing page structure, copy, interest-track cards, waitlist questions, ad/post variants, image prompts, launch plan, metrics, and decision rules.

Do not publish anything. This is a draft for Orchestrator review.
```

### Task 2 — Product Builder Agent

Prompt:

```text
Implement Issue 3 exactly from docs/plans/tickets-03-06.md.

Do not implement tabs, schemas, parser, storage, or UI behavior beyond the minimal AGym heading.

Run and report exact results for:

npm ci
npm run lint
npm run typecheck
npm run test:run
npm run build

Return branch name, files changed, summary, commands run, deviations, risks, and whether it is ready for Orchestrator review.
```

## Founder check-in format

The founder should only need to review Orchestrator approval cards.

Example:

```text
APPROVAL CARD — Waitlist smoke test v1

Recommendation: Approve with minor edits

What was produced:
- landing page copy
- three interest cards
- waitlist form
- five posts

Evidence checked:
- no medical claims
- no fake traction
- v0 constraints respected

Risks:
- AI Plan Tracker may imply product scope beyond current MVP unless framed as “interest track”

Founder decision needed:
- approve copy for landing-page draft
- approve waitlist form questions
- approve whether to launch organic-only or small paid test

If approved, next action:
- build landing page in Carrd/Framer/static page
```

## Decision rule

After the first cycle:

- If Marketing output is good, create the landing page.
- If Product Builder output passes Orchestrator review, open PR for Issue 3.
- If both succeed, run campaign and continue Issue 4.
- If campaign strongly prefers AI Plan Tracker, do not immediately abandon Issue 3; the shared product foundation is still needed.
