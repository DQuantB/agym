# AGym Waitlist Advertising Strategy v1.1

Status: founder-approved direction (2026-07-18). v1.1 supersedes v1 same-day after founder accepted three critique-driven changes (see changelog at bottom). Execution steps still require per-step founder approval where noted (publishing, spend, email collection, DMs).

## Founder decisions (2026-07-18)

1. Budget: organic-first; up to **€50–150 paid**, but Meta is demoted to an optional creative-legibility check, not a demand-signal test.
2. Channels: **Reddit/niche communities and X** are primary (direct-first, not post-first); **Meta** optional/gated; Product Hunt/directories deferred.
3. Landing page + waitlist form: not built yet — Phase 0. The page should be **demo-first**, not waitlist-only.

## Core strategic shift in v1.1

Waitlist emails are weak validation for a data-layer product. The question that matters is behavioral: **will people paste a messy log and correct the parse?** Because v0 is local-first and browser-based, we can put a micro-demo of the actual loop on the landing page and make the waitlist the *second* step. Signups then measure demonstrated interest after seeing the mechanism, not curiosity about a headline.

Funnel: visit → try demo (paste/pick a messy log → see parsed preview → correct one field) → "Join the waitlist to save your data and get Coach Briefings" → track selection + qualification questions.

## Phase 0 — Demo-first landing page (Week 1, blocks everything)

- Demo implementation, in order of preference:
  1. Embed the real v0 deterministic parser (it's TypeScript, browser-compatible; reuse the MVP slice) — nothing is faked.
  2. If the parser isn't embeddable in time: a scripted interactive walkthrough using 2–3 canned messy logs from `docs/evals/sample-logs.md`, **clearly labeled "interactive preview"** — no fake free-text parsing, per the no-implied-features rule.
- Surface: Framer or static page in repo (the demo needs JS; Carrd is out). Form via Tally or native.
- Copy: reuse `waitlist-smoke-test-v1.md` — hero control `Stop re-explaining your fitness history to ChatGPT.`, problem section, privacy disclosure, 6-question form. Three-track cards move **below** the demo.
- Known cost, accepted: three doorways plus a demo will depress raw signup conversion vs a single-CTA page. Do not misread the headline conversion number; the funnel metrics below are primary.
- Visuals: Concept B per `brand-system.md`; S3 background permitted as hero base.
- Analytics: privacy-light, with events for `demo_started`, `demo_corrected`, `signup`. `?src=` tags: `x`, `reddit-<sub>`, `dm`, `meta`.
- Founder approval required before the form goes live.

## Phase 1 — Direct-first organic (Weeks 1–2, €0)

Assumption: X is cold-start (unconfirmed — see open questions). For a cold account, broadcast posts yield ~zero visitors; the yield is in conversations. Priority order:

1. **Direct discovery (primary): 20–30 DMs/messages** to people who publicly describe this pain (posted a ChatGPT workout plan, complained about AI memory, quantified-self loggers). Ask about their current workaround before pitching; link the demo only if the pain is confirmed. Requires founder approval before any outreach; log every contact and response theme.
2. **Reply-first presence (daily, 15 min):** answer existing X/Reddit threads about AI fitness plans, ChatGPT memory, and log-keeping with actual help. Link only when relevant or asked.
3. **Community feedback posts (3–5 communities, one per day max):** quantified-self, LLM-user, workout-logging subs. Format: "would this solve anything for you?" + demo link where rules allow. Read each sub's self-promo rules first; log post URLs and themes.
4. **Build-in-public posts (secondary, 2–3/week):** problem narrative, the loop shown visually, local-first stance. These compound; they are not the Phase 1 engine.

What Phase 1 must answer: do people who feel the pain complete the demo, and does the demo change what they say? Which track do qualified users pick? What words do they use?

## Phase 2 — Optional paid legibility check (Week 3, ≤ €50 first, gated)

Reframed: Meta cannot target "people who paste workout logs into ChatGPT," so it is **not** a demand test at this budget (~30–60 clicks). It answers one question only: *do cold strangers understand what AGym is from the creative?*

- Gate: run only if Phase 1 produced ≥ 10 qualified demo-completers (otherwise fix message/product first) and founder approves spend.
- Setup: one campaign, S3 vs S4 (v3 assets), €7–10/day for 5–7 days, hard stop €50. Success metric: CTR ≥ 0.8% and demo-start rate of paid visitors within 2× of organic. Signups from Meta are a bonus, not the metric.
- Remaining budget (up to €100) stays reserved; candidate use: a promoted post in a high-fit community if its rules allow, decided with the founder after Phase 1.
- Full measurement ledger per the memory protocol.

## Phase 3 — Review and decide (end of Week 3)

Primary metrics (behavioral, replacing signup-count targets from v1):

- demo-start rate ≥ 30% of unique visitors;
- demo→signup ≥ 40% of demo-completers;
- ≥ 40% of signups already use AI for fitness (often/sometimes);
- ≥ 10 free-text answers with concrete pain language;
- DM conversations: ≥ 5 of 20–30 confirm the re-explaining pain unprompted.

Decision rules: track pull sets beta emphasis (per `waitlist-smoke-test-v1.md` §Decision rules). Strong behavioral signal → invite first beta cohort (10–30 users). Weak signal → revise positioning; the demo funnel will show *where* it breaks (nobody starts = message problem; start but don't sign up = value problem). No PH/directory launch until the funnel converts.

## Beta transition (post-validation)

- Invite in small batches ordered by qualification and demo completion (demo-completers first — they've already done the activation behavior).
- First email: personal, founder-written, expectation-setting (v0 local-first, browser-based, no advice). Activation ask: one real messy log.
- Measure: invite→activation (first confirmed event), then first Coach Briefing export.

## Guardrails (unchanged, from marketing-agent.md)

No medical/advice claims, fake traction, implied unbuilt features (the demo must be real or labeled a preview), or coaching-outcome promises. Founder approval before publishing, spend, email collection, DMs, or privacy-language changes.

## Open questions

1. Can the v0 parser slice be embedded in the landing page within Week 1? (Determines demo option 1 vs 2 — check with product-builder agent.)
2. Founder's X account state — existing audience or cold-start?
3. Which communities allow feedback posts with links? (Scouting pass needed.)
4. Founder approval of v3 creative as the legibility-check control (outstanding since 2026-07-11).

## Changelog

- **v1.1 (2026-07-18):** Meta demoted from demand test to optional ≤€50 legibility check (audience-targeting mismatch, sample too small); landing page changed from waitlist-only to demo-first with behavioral funnel metrics; organic reordered to direct-first (DMs + replies primary, posts secondary) under cold-start assumption; three-track conversion cost stated explicitly. Founder accepted all three critiques.
- **v1 (2026-07-18):** initial phased plan (organic → €50–150 Meta demand test → review).
