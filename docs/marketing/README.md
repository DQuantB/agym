# AGym Marketing Memory

This directory is the durable source of truth for AGym marketing work. It is not evidence that a message, asset, or channel works; it records what was attempted, why, and what was learned.

## Source-of-truth order

1. `../agents/marketing-agent.md` — coach-first product boundaries, claims rules, agent workflow, and approval limits.
2. `../agents/marketing-subagents.md` — bounded worker contracts and output schemas.
3. `experiments/2026-08-01-coach-discovery-sprint-v1.md` — active research protocol for the coach-first wedge.
4. `brand-system.md` — current visual/voice system when visual work is required.
5. `experiments/` — experiment briefs, results, and explicit founder decisions.
6. `assets/` — versioned source and finished assets; never use a filename alone as a performance claim.
7. `waitlist-smoke-test-v1.md`, `advertising-strategy-v1.md`, and historical paid/social assets — earlier consumer-oriented work, retained for traceability only; not active proof or an execution plan for Coach Discovery Sprint v1.

If these files disagree on product scope or claims, `../agents/marketing-agent.md` wins. Product implementation source documents still control what AGym actually does.

## Required workflow for every marketing task

### Before creating work

1. Read this file, `brand-system.md`, the current experiment brief, and relevant existing assets.
2. State whether the task is a draft, an internal-ready asset, a live test, or an evidence-backed learning.
3. Reuse the current visual system unless the task explicitly tests a new visual variable.
4. Confirm the task does not imply coaching, medical advice, product availability, outcomes, testimonials, or traction.

### After creating work

1. Save copy, prompts, source files, final exports, and paths under `docs/marketing/`.
2. Add or update an experiment record with the exact version IDs and review status.
3. Record what is hypothesis versus measured evidence.
4. Add a dated entry under `## Activity log` below, with assets/copy changed, the decision, and next question.
5. Do not publish, spend money, collect real emails, or present internal assets as live without founder approval.

## Asset naming

`agym-<channel>-<concept>-v<version>-<state>.<extension>`

States:
- `background` — visual source intended for later composition.
- `draft` — internal review only.
- `finished` — internally reviewed/exported, not necessarily approved or live.
- `live` — externally published; include date and channel in the experiment record.

## Activity log

### 2026-08-01 — Coach Discovery Marketing Agent v2 foundation

- Founder selected a coach-first demand-validation wedge: independent online strength/hypertrophy coaches who need better context from recurring client check-ins and may use their own LLMs for preparation.
- Rewrote `docs/agents/marketing-agent.md` as Coach Discovery v2, preserving AGym's non-coach, no-medical-claims, raw-input/uncertainty boundaries.
- Added `docs/agents/marketing-subagents.md` with four bounded roles: public ICP/community research, founder-reviewed no-link outreach drafting, conversation analysis, and future-prototype demo/positioning writing.
- Added `experiments/2026-08-01-coach-discovery-sprint-v1.md`: a 15-conversation evidence gate, anonymized ledger template, and explicit founder approvals before any outreach or prototype explanation.
- Status: internal research protocol only. No coach was contacted, no personal data was collected, and no product capability or market demand has been validated.
- Next question: does the founder confirm the first ICP and approve research of the first five public-source prospects?

### 2026-07-11 — waitlist and Meta v1 package

- Created the internal waitlist smoke-test package: `waitlist-smoke-test-v1.md`.
- Established the first campaign control: `Stop re-explaining your fitness history to AI.`
- Generated/reviewed black-and-white instructional-manga visual assets and composed finished landing-page hero and square-feed creative.
- Created `meta-ads-v1.md` and `experiments/2026-07-11-waitlist-meta-v1.md`.
- Status: internal-ready creative package; not published, no spend, no live landing page/form, and no market-performance evidence.
- Next question: does the control message generate qualified waitlist signups among people already using AI for fitness?

### 2026-07-11 — visual refinement and first organic post

- Marketing Agent reviewed the v1 creative and recommended a single recurring visual device: `raw note > user review > confirmed context sheet`.
- Replaced the internal M1 Meta control with the more legible v1.1 composition: `assets/meta-ads-v1/agym-meta-feed-m1-v1.1-finished.png`.
- Created the first organic explanatory 4:5 post: `assets/social-organic-v1/agym-social-one-note-v1-finished.png`, with full caption and publication guardrails in `social-organic-v1.md`.
- Status: internally reviewed refinements; still unpublished and untested. The message test remains M1; this is not evidence that either visual performs better.
- Next question: after a functional landing page/form exists, does M1 produce qualified signups before any new visual-system test?

### 2026-07-11 — design direction reset

- Founder rejected the instructional-manga direction as a mismatch for AGym’s desired tech-savvy, fitness-related vibe.
- Created `docs/design/DESIGN.md` as the active visual source of truth and rewrote `brand-system.md` as Marketing Brand System v2.
- New direction: performance-interface editorial — real athletic moments/objects plus sparse, disciplined context/data overlays; ink/bone base with one restrained lime or blue signal accent.
- Existing manga assets remain internal historical records only. They are unpublished and have no market-performance interpretation.
- Next question: create and internally review one Meta M1 control and one organic social post that apply the new design direction while keeping the message test disciplined.

### 2026-07-11 — performance-interface editorial v2 assets

- Marketing Agent created the v2 creative brief from `docs/design/DESIGN.md` before visual production.
- Created and internally reviewed a new Meta M1 control: `assets/meta-ads-v2/agym-meta-m1-v2-finished.png`.
- Created and internally reviewed a new organic 4:5 post: `assets/social-organic-v2/agym-social-o2-v2-finished.png`.
- Both use real post-training moments, compact physically attached training-context cards, and a restrained single signal color—lime for M1 confirmation/actionability; blue for O2 informational context.
- Full copy, exact generation prompts, sources, export paths, and guardrails are in `performance-interface-v2.md`; the measurement ledger is in `experiments/2026-07-11-performance-interface-v2.md`.
- Status: unpublished, untested internal assets. They express a new design hypothesis, not market evidence.
- Next question: founder review of v2 direction, then landing page/form readiness before any approved external test.

### 2026-07-11 — v2 visual execution rejected

- Founder accepted the message direction but rejected the v2 performance-interface visual execution as not good enough for the desired AGym vibe.
- Rejected cues: staged AI stock-photo realism, warm paper/ripped-paper look, literal fitness props, and simplistic pasted-on context-card/accent-arrow treatment.
- V2 assets remain local historical internal records only. They are unpublished and have no performance interpretation.
- Next question: collect founder-selected visual references, extract their common principles, revise `docs/design/DESIGN.md`, and create a small concept board before generating another full ad/post pair.

### 2026-07-11 — founder references distilled; concept board is next

- Founder selected Nike Running Club Instagram-post energy and supplied seven poster/editorial visual references.
- Created `reference-study-2026-07-11.md`; the transferable principles are type-led compositions, controlled collision, charged limited palettes, transformed imagery, kinetic/athletic energy, and technical rhythm without dashboards.
- Rewrote `docs/design/DESIGN.md` and Marketing Brand System v3 around a type-led kinetic-editorial direction. This replaces the rejected performance-interface execution for future exploration.
- Status: direction brief only. No new creative has been generated, published, or tested; no third-party design or brand asset may be reused.
- Next question: which of the three original concept-board territories should define AGym's visual system?

### 2026-07-11 — three-territory concept board created

- Created an original, deterministic concept board at `assets/concept-board-v1/agym-concept-board-v1-finished.png` plus three 1080×1350 review tiles and the reproducible renderer `assets/concept-board-v1/render_concept_board.py`.
- The board turns the founder references into three distinct options: A kinetic type/data rhythm, B distorted-object translation, and C motion-field editorial.
- Exact paths, messages, rationale, source method, guardrails, and the founder decision request are documented in `concept-board-v1.md`.
- Internal visual QA found no third-party marks, fake UI, medical imagery, or prohibited claims; B was revised after QA so its supporting copy is no longer overlapped.
- Status: internally reviewed direction artifact only. It is unpublished, untested, and requires a founder choice before polished campaign production.
- Next question: choose A, B, C, or a named combination.

### 2026-07-11 — founder selected Concept B

- Founder selected **B / distorted-object translation** as the primary AGym visual system because it is the clearest product expression.
- Founder likes C's deep-teal/shell/coral palette and interesting abstract energy, but considers its product meaning insufficiently clear. It is approved only as a secondary input to a clear B-mechanism variation.
- Founder rejected A as unclear, while leaving its palette as a possible future color exploration—not its composition.
- Updated `docs/design/DESIGN.md`, `brand-system.md`, and `concept-board-v1.md` with the decision and next-production constraints.
- Status: no placement-specific campaign asset has been generated, published, or tested. Next: create original B-system internal creative for the agreed placement(s).

### 2026-07-11 — training legibility added to B system

- Founder noted that B is clear as a visual transformation but does not yet clearly communicate that AGym is about training.
- Updated `docs/design/DESIGN.md`, `brand-system.md`, and `concept-board-v1.md`: every future B-system asset needs at least two integrated training anchors, including a plain-language training cue, compact training-log notation, a non-branded movement/exertion cue, or a training-specific transformation.
- This is a design constraint for the next asset, not a change to AGym's product scope or a claim of a live product.

### 2026-07-11 — training-explicit Concept B Meta creative v3

- Created two original, deterministic, founder-review Meta executions under selected Concept B: S3 at 1080×1080 in the primary cream/charcoal/orange system, and S4 at 1080×1350 using the permitted deep-teal/shell/coral variation.
- Both assets make training explicit with plain-language training copy, compact training-log notation, an abstract rep/interval trace, and the fragmented-training-log-to-confirmed-context mechanism.
- Finished assets, clean backgrounds, source renderer, copy, QA, and approval boundaries are recorded in `meta-ads-v3-training-translation.md` and `assets/meta-ads-v3/`.
- Status: internally reviewed only; no publishing, spend, email collection, or performance data. These are not evidence that either copy or visual works.
- Next question: founder review—does the training-explicit B system now feel clear and visually right enough to use as the primary waitlist-ad control?

### 2026-07-18 — founder-approved waitlist advertising strategy v1

- Founder confirmed the go-to-market sequence: waitlist first to validate demand, then open the waitlist to beta users and iterate on the app.
- Founder decisions: organic-first with a **€50–150 small paid Meta test** afterward (no paid-first launch); priority channels are **Reddit/niche communities, X build-in-public, and Meta ads**; Product Hunt/directories deferred; landing page + form **do not exist yet** and are Phase 0.
- Created `advertising-strategy-v1.md`: Phase 0 landing page build (reusing `waitlist-smoke-test-v1.md` copy and Concept B visuals), Phase 1 two-week organic push holding M1 constant, Phase 2 gated €50–150 Meta test using the v3 S3/S4 assets as an S3-vs-S4 visual test, Phase 3 decision review, plus beta-transition plan and kill/scale rules.
- Everything remains hypothesis: no publishing, spend, email collection, or performance data yet. Targets in the strategy are unvalidated planning numbers.
- Open items: subreddit/community scouting, founder X reach (cold-start?), landing-page surface choice, and explicit founder approval of the v3 creative as the paid control (still outstanding from 2026-07-11).
- Next question: build and founder-approve the landing page + form so Phase 1 organic can start.

### 2026-07-18 — strategy revised to v1.1 after critique

- Marketing critique surfaced three weaknesses in v1; founder accepted all three and asked for a better plan.
- Decisions recorded:
  1. **Meta demoted.** At €50–150 Meta cannot target the ICP (people who paste workout logs into AI) and yields ~30–60 clicks — too small for demand signal. It is now an optional ≤€50 creative-legibility check, gated on Phase 1 results and founder approval. Remaining budget reserved.
  2. **Demo-first validation.** Waitlist emails are weak evidence for a data-layer product. The landing page will lead with a micro-demo of the real loop (paste/pick messy log → parsed preview → correct → then waitlist). Prefer embedding the real v0 parser; fall back to a clearly labeled scripted preview. New primary metrics are behavioral: demo-start rate, demo→signup rate.
  3. **Direct-first organic.** Under a cold-start X assumption, DMs (20–30, founder-approved) and reply-first participation are the primary engine; community feedback posts next; build-in-public posts secondary.
- Also recorded: the three-track layout is expected to depress raw conversion; this is an accepted experiment cost and must not be misread later.
- `advertising-strategy-v1.md` rewritten in place as v1.1 with a changelog; v1 remains described there.
- Status: still all hypothesis — nothing published, no spend, no emails collected.
- Next question: can the v0 parser slice be embedded in the landing page within Week 1 (demo option 1 vs 2)?

### 2026-07-18 — outreach and paid-channel tactics clarified

- Founder asked whether to start Reddit/X messaging now, whether outreach can be automated with a bot/AI, and whether paid budget should move from Meta to Reddit/X. Guidance recorded:
  1. **Outreach timing split.** No-link discovery conversations (current workaround, is re-explaining painful) may start immediately; pitch messages with a link wait for the live demo page. Best prospects are scarce — don't burn them on a first impression without the demo.
  2. **No automated sending.** Bot DMs violate Reddit/X spam rules, risk account bans that would kill the organic plan, are easily detected by the AI-native ICP, and breach the marketing-agent guardrail requiring founder approval per contact. AI may prospect, draft, and triage; a human reviews and sends every message. On Reddit, public helpful comment before DM; on X, replies first since DMs are often closed.
  3. **Paid budget reallocation (pending founder confirmation): Reddit ads replace Meta** as the preferred ≤€100 paid probe, because subreddit targeting reaches the actual ICP, which Meta interest targeting cannot. X ads rejected (poor targeting, high CPM at small budgets). Same gate: live demo page + some organic pull + founder approval before any spend.
- Status: recommendations 1–2 adopted as working practice; 3 awaits explicit founder confirmation before the strategy doc's Phase 2 is rewritten around Reddit ads.
- Next question: founder confirms Reddit-ads swap, and the discovery-conversation prospect list (10–20 names/threads) gets built.

### 2026-07-18 — step-by-step launch playbook created

- Created `launch-playbook-v1.md`, the operational companion to `advertising-strategy-v1.md` (v1.1): Week 0 prep (account choice, community scouting doc, prospect list, discovery conversations with a ≥5/15 pain-confirmation checkpoint, demo-feasibility decision), Week 1 demo-first page build + QA + go-live gate, Week 2 daily organic loop (DM follow-ups, reply-first, one community post/day, two X posts) with a Day-7 midpoint review, Week 3 second wave + gated ≤€100 Reddit-ads probe with kill rules, end-of-Week-3 decision memo and beta go/no-go.
- Playbook encodes the standing rules: human sends everything, founder gates on publish/spend/emails/DMs, M1 message held constant, same-day memory updates.
- Paid channel written as Reddit ads per the 2026-07-18 guidance; Meta dropped from the playbook (strategy doc Phase 2 still mentions Meta until the founder's explicit confirmation is logged).
- New artifacts the playbook will create: `community-scouting-2026-07.md`, `prospects-2026-07.md`, `experiments/2026-07-XX-waitlist-launch-v1.md`.
- Status: plan only; nothing executed, published, or spent.
- Next question: founder answers the three Week-0 blockers — which X/Reddit accounts to use, parser embeddability (demo option 1 vs 2), and confirmation of the Reddit-ads swap.

### 2026-07-18 — founder has no X or Reddit accounts; cold-start adjustments

- New context: the founder has **no existing X or Reddit accounts**. Both platforms suppress new accounts (Reddit: karma/age gates + link shadowbans; X: no reach, DMs closed to non-followers).
- Playbook updated accordingly:
  1. Create both accounts immediately (founder-personal X handle; aging clock starts now). X Premium (~€8/mo) recommended for reply visibility + open DMs — possibly better ROI than the first ad euros.
  2. Organic subreddit posts deferred to Week 3–4; Weeks 0–2 on Reddit are comment-only warm-up with zero AGym mentions.
  3. Cold-start channels added with no account-age penalty and the same ICP: **Show HN** (slots into Week 2 once the demo is stable — strong local-first/data-ownership fit), **Indie Hackers**, and **Discord** fitness/QS/AI servers.
  4. Reddit **ads** gain relative importance since promoted posts bypass karma gates.
- Status: playbook v1 amended in place; still nothing executed or spent.
- Next question: accounts created? And does the founder approve the €8/mo X Premium as the first marketing spend?

### 2026-07-18 — execution calendar + social presence program

- Founder asked for a concrete task list, daily/weekly/monthly plan with deliverables, and a social-presence build-out. Created `execution-calendar-v1.md`:
  - master task checklist by phase (Week 0 → Week 4+/beta) with founder-vs-agent ownership per task;
  - daily rhythm (~45–60 founder-min: outreach queue, reply-first engagement, draft approvals, dogfooded training logging);
  - weekly rhythm (2 X posts, 1 community touchpoint, 10–15 outreach messages, Friday review note);
  - monthly arcs — M1 validate demand (beta go/no-go), M2 beta + presence, M3 iterate + scale decision — each with deliverables and KPI focus;
  - social presence program: four X content pillars (build-in-public, the context pain, data-ownership opinions, dogfooded training log), Reddit karma-building protocol, Discord approach, and monthly presence targets framed as hypotheses (M1 50–100 followers → M3 300–500 with inbound DMs).
- Positioning choice recorded: presence goal is credibility with 200–500 right people, conversations over impressions; no engagement bait; founder voice on everything.
- Status: planning artifact; nothing executed. All targets are unvalidated hypotheses.
- Next question: founder completes the "Do now" block (accounts, X Premium decision, demo feasibility, Reddit-ads confirmation) so Week 0 can actually start.

### 2026-07-18 — social visual prompt library created

- Created `visual-prompts-v1.md`: reusable image-generation prompts for all social placements under Concept B — four IG pillar posts (pain, dogfood log, data ownership, build-in-public), 9:16 story, Reddit-native ad, IG ad (reuses S4 via renderer, no new generation), avatar, X banner, and landing hero (prefers adapting the existing S3 background).
- Every prompt is split into an image prompt (background/object layer only — model may render no readable text) and a deterministic overlay spec (headline, training anchors, `RAW > REVIEWED > READY`, disclosures), per the brand-system rule. A universal negative prompt and a per-asset QA checklist are included.
- Status: prompt library only; no assets generated yet. Any generated asset starts as `draft` and follows the standard naming/review path.
- Next question: generate the first batch (suggested: D1 avatar + D2 banner first, needed for account creation, then A1) and internally review against the QA checklist.
