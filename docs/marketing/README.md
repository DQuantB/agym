# AGym Marketing Memory

This directory is the durable source of truth for AGym marketing work. It is not evidence that a message, asset, or channel works; it records what was attempted, why, and what was learned.

## Source-of-truth order

1. `../agents/marketing-agent.md` — product boundaries, claims rules, agent workflow, and approval limits.
2. `brand-system.md` — current marketing visual/voice system and asset-status rules.
3. `waitlist-smoke-test-v1.md` — original waitlist-test design.
4. `meta-ads-v1.md` — historical v1 paid-social creative handoff.
5. `reference-study-2026-07-11.md` — founder-provided visual-reference analysis and proposed concept-board territories.
6. `concept-board-v1.md` — founder decision selecting Concept B and the approved secondary input from C.
7. `meta-ads-v3-training-translation.md` — current internally reviewed, training-explicit Concept B Meta creative handoff.
8. `performance-interface-v2.md` — historical v2 creative handoff; not an active system.
9. `experiments/` — experiment briefs, results, and explicit founder decisions.
10. `assets/` — versioned source and finished assets; never use a filename alone as a performance claim.

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
