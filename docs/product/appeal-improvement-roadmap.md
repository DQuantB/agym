# AGym — Appeal Improvement Roadmap

**Goal:** build for customers first, in a shape investors and acquirers recognize as a vertical-AI business (per Bessemer's *Building Vertical AI*, Jan 2026).
**Current state assumed:** local-first Logger + Coach Briefing slice working; MCP server prototype; no backend/payments/dashboard.

---

## The one-sentence repositioning

Stop describing AGym as "a data layer" (infrastructure story — hard to buy, hard to invest in) and start describing it as:

> **"AGym turns messy training reality into agent-readable, coach-billable truth."**

Data layer is the *architecture*. The *product* is the Coach Briefing — the artifact someone pays for. EvenUp isn't pitched as "a legal data layer"; it's pitched as demand packages. Same move.

---

## Track A — Customer appeal (consumer/self-coached users)

The consumer problem isn't parsing; it's that **logging dies by week 3**. Every improvement below attacks time-to-log or reason-to-return.

### A1. Cut logging friction below 10 seconds
- **Voice-first capture.** Speech-to-text is the mature modality (Bessemer Part II). One button, ramble after a workout, done. This is the single highest-leverage feature for retention.
- **Zero-decision logging.** Accept anything: "did legs, felt weak, skipped last set." Never block on structure — parse, flag uncertainty, move on. You already do this; make it the marketing headline.
- **Correction as a 2-tap act,** not a JSON editor. The editable JSON preview is right for v0 validation but is developer UX. Ship chip/inline corrections ("was it 80kg or 85kg?"); keep raw JSON behind an "advanced" toggle.

### A2. Give the loop a visible payoff (reason to return)
- **The briefing must feel like magic, not a summary.** Add trend deltas ("bench up 7.5kg over 6 weeks, but you've skipped 4 of the last 6 planned rest days") and plan-vs-actual adherence %. Plan adherence is your unique data — no wearable has it.
- **"Paste this to your AI" moment.** One-click copy of a compact context block for ChatGPT/Claude, with a visible before/after: generic advice vs. advice with AGym context. This demo *is* the product's value proof — put it on the landing page.
- **Streaks on corrections, not workouts.** Rewarding confirmed/corrected events (not gym visits) avoids toxic-fitness incentives and grows exactly the data quality moat (Bessemer principle 10).

### A3. Meet users where their agents live
- **Ship the MCP server as the flagship integration, not a side artifact.** "Add AGym to Claude/ChatGPT and your AI remembers your training" is a 2026-native pitch no incumbent fitness app makes. Prioritize: `get_context`, `log_raw`, `propose_plan` tools.
- **Plan intake from any agent.** The write-side of the micro-app contract is under-demonstrated. A user pasting a ChatGPT-generated program into AGym and seeing it become trackable structure is the "aha" for the write→read loop.

---

## Track B — Customer appeal (coaches/trainers, B2B)

This is the Bessemer-aligned wedge: coaching is a labor business; briefings replace non-billable hours. Highest-ROI story you have.

### B1. Minimum coach product (build only after A validates the loop)
- **Client roster view:** list of clients, last log date, red/yellow/green adherence flag. That's it — not a dashboard.
- **Weekly briefing digest:** auto-generated Coach Briefing per client, emailed or exported. Coach reads 5 briefings in 10 minutes instead of chasing 5 clients on WhatsApp.
- **Client → coach share link** with scoped, revocable consent. This is also your privacy story made tangible: user-owned data, explicitly shared.

### B2. Hard-ROI framing (Bessemer principle 4)
- The pitch to a coach: "carry 30 clients with the check-in overhead of 15." Quantify: if check-in prep is 20 min/client/week at €50/hr effective rate, a briefing worth 15 saved minutes justifies €5–8/client/month easily.
- **Pricing:** per active client per month (usage-based, Bessemer Part III), small base fee. Never per-seat — coaches are solo operators.

### B3. Validation before building
Put 5 manually-generated briefings (real or realistic data) in front of 5–10 real coaches. Ask two questions: "Would you send this to yourself weekly?" and "What's it worth per client?" Do this *before* writing roster code.

---

## Track C — Investor/buyer appeal

Investors buy the same product customers do, plus defensibility and metrics. Changes that shift the story:

### C1. Sharpen the moat narrative (what survives ChatGPT memory?)
Say it explicitly in the deck and README:
1. **Corrected longitudinal data.** Platform memory stores what users *said*; AGym stores what users *confirmed happened*, with plan-vs-actual linkage. That correction layer is the EvenUp-style quality moat.
2. **The write/read contract.** If multiple agents/tools adopt AGym's plan-in/outcome-out schema, you're a protocol position, not an app. Publish the schema openly — adoption is the moat, secrecy isn't.
3. **Coach network.** Platforms won't build per-vertical trust workflows (consent scoping, coach sharing, safety flags).

### C2. Instrument the loop — your metrics ARE the pitch
Define and track from day one (privacy-consistent, local-first counts are fine initially):
- **Loop completion rate:** % of plans that get ≥1 logged outcome (the core thesis metric).
- **Correction rate & time-to-confirm:** proof the data quality flywheel spins.
- **W4 logging retention:** the consumer graveyard metric — beating it is the headline.
- **Context pulls per user:** how often agents actually read the memory (demand for the read-side).
An investor who sees "62% of AI-generated plans get real-world outcome data logged against them" understands the business in one line.

### C3. Safety and privacy as a feature, not a disclaimer
- Keep the no-medical-claims + uncertainty-flags stance, but productize it: a visible "safety routing" behavior (pain/ED-like signals → human-review language) is a differentiator for acquirers (Whoop, Strava, EGym, coach platforms like Trainerize) who carry regulatory exposure.
- User-owned export/delete is already built — market it. "Your data leaves with you" is both a consumer trust hook and a GDPR story for EU buyers.

### C4. Name the buyers early
Plausible acquirers shape the roadmap: coach-platform incumbents (Trainerize/ABC Fitness, Everfit), device companies wanting plan-adherence data (Whoop, Garmin), and AI platforms wanting vertical memory. Everything in C1–C3 makes AGym legible to all three.

---

## Sequencing (opinionated)

| Phase | Weeks | Ship | Kills the risk that… |
|---|---|---|---|
| 1 | 1–4 | Voice logging, 2-tap corrections, briefing with trends + "paste to AI" block, MCP `get_context` polished | …nobody logs past week 3 |
| 2 | 3–6 (overlap) | Coach briefing validation interviews (no code) | …coaches won't pay |
| 3 | 5–10 | Loop metrics instrumentation + landing page with before/after demo | …the story isn't provable |
| 4 | 8–14 | Coach share link + roster-lite (only if Phase 2 validates) | …B2B wedge is imaginary |

**Anti-goals unchanged:** no full AI coach, no recommendation engine, no wearables yet, no proprietary model. The parser is table stakes (Bessemer principle 2) — never let it become the pitch.

---

## The two demos that sell everything

1. **Consumer demo (30s):** speak a messy log → confirmed event → "paste to AI" → visibly better ChatGPT answer.
2. **Coach demo (60s):** 3 clients' messy weeks → 3 one-page briefings → "which client needs you today?"

If both demos land, customers retain, coaches pay, and investors see a vertical-AI business with a protocol upside. Build toward the demos.
