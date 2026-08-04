# AGym Waitlist Launch Playbook v1

Status: execution companion to `advertising-strategy-v1.md` (v1.1). Created 2026-07-18. This is the step-by-step operational plan; the strategy doc holds the reasoning. Paid channel written as Reddit ads per 2026-07-18 guidance (founder confirmation of the Meta→Reddit swap noted in README activity log).

Every step marked **[FOUNDER]** requires the founder to act or approve. Everything else can be prepared by the marketing agent.

---

## Week 0 — Preparation (can start today, no page needed)

### Day 1–2: accounts, scouting, prospect list

1. **[FOUNDER]** Create accounts **today** — the founder has none (confirmed 2026-07-18), so the aging clock starts now:
   - **X:** create a founder-personal handle (people follow people, not pre-launch brands). Consider X Premium (~€8/mo) — it materially improves reply visibility and opens DMs to non-followers; arguably better ROI than the first €10 of ads. Fill bio, post 2–3 non-promotional posts before any outreach.
   - **Reddit:** create an account and accept the constraint — most target subs require account age/karma, so **organic subreddit posts move to Week 3–4 at the earliest**. Weeks 0–2 are comment-only warm-up (5–10 genuine comments/week in target subs, zero AGym mentions). Reddit **ads** do not require karma, which makes the paid probe relatively more important in this cold-start scenario.
   - **Cold-start channel additions** (no account-age penalty, same ICP): **Hacker News** — a Show HN of the live demo is a strong fit (local-first, data-ownership, AI-context pain resonate there; account needed but no karma gate; read Show HN rules first); **Discord** fitness/quantified-self/AI-tools servers (join Week 0, participate, share demo where rules allow); **Indie Hackers** launch post. These replace the Week-2 subreddit posts in the schedule; Show HN slots where community posts were (Week 2, once the demo is live and stable — HN traffic is one-shot, don't waste it on a broken page).
2. Community scouting pass (agent): for each candidate community record — name, size, self-promo rules, link policy, feedback-post precedent, mod-approval process. Candidate list to verify: quantified-self, LLM/AI-tools user subs, workout-logging subs (Strong/Hevy user communities), r/Fitness-adjacent smaller subs, relevant Discord servers. Output: `docs/marketing/community-scouting-2026-07.md` with a GO / ASK-MODS / NO rating per community.
3. Prospect list v1 (agent drafts, founder reviews): 20–30 entries. Sources: X search for complaints about ChatGPT fitness plans/AI memory; Reddit threads about logging friction; quantified-self posters. Per entry: handle, platform, the exact post showing pain, proposed opener. Output: `docs/marketing/prospects-2026-07.md` (no outreach yet).
4. Account warm-up starts (founder, ~10 min/day): genuinely reply to 2–3 threads/day in target communities. No AGym mention. Goal: comment history that makes later posts credible.

### Day 3–5: discovery conversations (no link, no pitch)

5. **[FOUNDER]** Approve prospect list and opener drafts.
6. Send 3–5 discovery messages/day (founder sends; agent drafts + triages replies). Script shape: reference their specific post → ask how they currently track / whether re-explaining context to AI annoys them → shut up and listen. No link, no product name unless asked.
7. Log every conversation in `docs/marketing/prospects-2026-07.md`: response y/n, their words for the pain, current workaround, permission to follow up ("can I ping you when the demo is up?").
8. Checkpoint: after ~15 conversations, tally how many confirm the re-explaining pain unprompted. ≥ 5/15 → proceed as planned. < 3/15 → pause page build, re-examine positioning with the founder before spending Week 1 on it.

### Parallel: demo feasibility

9. **[FOUNDER / product-builder agent]** Answer the open question: can the v0 parser slice run in the landing page? Decision by end of Week 0 → determines demo option 1 (real parser) vs option 2 (labeled scripted preview with `docs/evals/sample-logs.md` fixtures).

## Week 1 — Build the demo-first page

### Day 1–3: build

10. Surface: Framer or static page in repo (demo needs JS). **[FOUNDER]** pick; default recommendation = static page in repo (full control, free, versioned).
11. Assemble per `advertising-strategy-v1.md` Phase 0: hero (M1 control headline), micro-demo above the fold, waitlist form (6 questions from `waitlist-smoke-test-v1.md`), three track cards below the demo, problem section, local-first/privacy disclosure near the form.
12. Analytics events wired: `visit` (with `?src=`), `demo_started`, `demo_corrected`, `signup`. Tags: `x`, `reddit-<sub>`, `dm`, `reddit-ads`.
13. Form backend: Tally (free tier, CSV export, no PII beyond email). Confirm export/delete request path is stated on the page.

### Day 4–5: QA + approval

14. QA checklist: demo works on mobile (most Reddit/X traffic is mobile); no claim from the forbidden list (`waitlist-smoke-test-v1.md` §guardrails); disclosure present; demo labeled "preview" if option 2; form submits; events fire; page loads < 2s.
15. **[FOUNDER]** Final review and go-live approval (this is the email-collection approval gate).
16. Create the experiment record: `docs/marketing/experiments/2026-07-XX-waitlist-launch-v1.md` — channels, asset/copy IDs, funnel metric definitions, empty results table.

## Week 2 — Organic push (daily cadence)

Daily loop (founder ~30–45 min/day, agent prepares everything the night before):

17. **Morning (10 min):** send 2–3 follow-ups to discovery contacts who gave permission ("demo's up — 60 seconds, would love your take: <link?src=dm>"). Send 2–3 new discovery/pitch messages from the list.
18. **Midday (10 min):** reply-first participation — 2–3 helpful replies in live threads; link only when contextually justified.
19. **Ongoing:** log responses and qualitative themes same day (agent).

Scheduled posts:

20. **Day 1:** founder problem-narrative post on X ("I asked ChatGPT for a training plan. Three weeks later it had no idea what I actually did.") + link. Cross-post nothing yet.
21. **Day 2–4 (cold-start substitution):** subreddit posts are deferred to Week 3–4 (account too new). Instead: one **Show HN** post (demo must be stable; founder present in comments all day), one **Indie Hackers** post, and demo shares in 1–2 GO-rated **Discord** servers. Log URLs and response themes.
22. **Day 5:** build-in-public post #2 on X: show the loop (Concept B visual or demo screen recording).
23. **Day 7:** mid-point review (agent produces, founder reads): funnel numbers by source, track split, qualitative themes, any community post that died or took off. Adjust Week 3 emphasis accordingly — double down on the source producing demo-completers.

## Week 3 — Second organic wave + gated paid probe

24. Continue daily loop; post build-in-public update #3 (what early users said — only real, permissioned quotes; no fabricated traction).
25. **Paid gate check:** ≥ 10 qualified demo-completers from organic AND founder approval → proceed to 26. Otherwise skip paid entirely and go to 29.
26. **[FOUNDER]** Reddit Ads setup (~1h): promoted-post format, plain-spoken copy (no display-ad gloss — native tone wins on Reddit), targeting = the 3–5 GO subreddits + interest fallback. Creative: adapt S3/S4 v3 assets or a plain text+screenshot post; A/B the two. Budget €10/day, 7 days, hard stop €100. UTM `?src=reddit-ads`.
27. Daily paid monitoring (agent): CTR, demo-start rate of paid visitors vs organic, cost per demo-completer. Kill rules: CTR < 0.4% after 2,000 impressions per variant → pause variant; paid demo-start rate < half of organic → pause campaign (page/audience mismatch, don't buy noise).
28. Record everything in the experiment record per the memory protocol (window, spend, impressions, clicks, visits, demo starts, signups, track split, themes).

## End of Week 3 — Review and decision

29. Agent compiles the decision memo: full funnel by source; metric thresholds from `advertising-strategy-v1.md` Phase 3 (demo-start ≥ 30%, demo→signup ≥ 40%, ≥ 40% AI-for-fitness users, ≥ 10 concrete free-text answers, ≥ 5/20 DM pain confirmations); track split; verbatim quotes; where the funnel leaks.
30. **[FOUNDER]** Decide per the decision rules: strong signal → invite first beta cohort (10–30, demo-completers first) and begin beta transition per strategy doc; weak signal → positioning revision sprint before any further spend or building; mixed → one more organic-only iteration with the revised message.
31. Log the decision and full results in the experiment record and README activity log. Only after a converting funnel: consider Product Hunt / BetaList.

---

## Standing rules for every step

- Nothing publishes, spends, or collects emails without the founder gate for that step.
- AI assists (prospecting, drafting, triage, analysis); a human sends every message and posts every post.
- One variable at a time: M1 message stays the control throughout; visual and channel are the only variables in play.
- Every action leaves a trace in `docs/marketing/` the same day (prospect log, experiment record, or activity log).
- Anything that looks like traction ("50 signups!") is not published unless true and founder-approved.

## Artifacts this playbook creates

| Artifact | When | Purpose |
|---|---|---|
| `community-scouting-2026-07.md` | Week 0 | GO/ASK/NO per community + rules |
| `prospects-2026-07.md` | Week 0, living | Outreach list + conversation log |
| `experiments/2026-07-XX-waitlist-launch-v1.md` | Week 1 | Measurement ledger for the whole launch |
| Landing page + demo | Week 1 | The validation instrument |
| Week-2 midpoint review | Week 2 Day 7 | Course correction |
| Decision memo | End Week 3 | Beta go/no-go |
