# AGym Instagram Editorial Plan v1

Status: plan only. Created 2026-08-05. Nothing here is published, tested, or approved. Launching the page is a founder decision that Coach Discovery Sprint v1 currently blocks (see §10).

Companions: `social-design-prompt-v1.md` (how posters get made), `brand-system.md` v3 (visual system), `docs/agents/marketing-agent.md` (claims rules, ICP), `execution-calendar-v1.md` (the rhythm this slots into).

---

## 1. The honest framing

Instagram is not in the current strategy. `advertising-strategy-v1.md` v1.1 demoted Meta and made X, Reddit, Discord, and Show HN the engine. Adding IG is a new channel bet, and it should be judged as one.

The case for it: the coach ICP genuinely lives on Instagram. Independent online strength coaches publish there, sell there, and are reachable there. That's not true of Reddit or Show HN. If coach discovery is the bottleneck — and you've said it is — IG is the only planned channel where the ICP is natively present.

The case against: IG rewards volume and personality, punishes links, and gives you no keyword targeting. A page with 40 followers converts almost nobody on its own. It works as a **discovery-conversation engine**, not as a funnel.

So the page has one primary job and one secondary job:

- **Primary — start coach conversations.** Content that makes a coach comment, DM, or accept a DM. The page is the reason a cold DM doesn't feel cold.
- **Secondary — survive the profile tap.** When you DM a coach, they check the profile. It must read as a real, serious, technically credible project, not a stock AI-fitness account.

Follower count is not a goal. The metric is qualified conversations.

## 2. What "working" looks like

Track weekly. All targets are hypotheses, not evidence.

| Metric | Why it matters | 6-week target |
|---|---|---|
| Qualified coach conversations started from IG | The actual point of the channel | ≥ 6 |
| Profile visits → link taps | Did the grid survive the tap | ≥ 15% of visits |
| Comments/DMs from accounts matching the ICP | Signal the content reaches coaches, not gym-bros | ≥ 10 |
| Saves per carousel | Saves mean "useful", the only IG signal that predicts return | ≥ 20 on best carousel |
| Reel reach outside followers | Whether reels work as the discovery vehicle at all | ≥ 60% non-follower |

**Kill/scale rule at week 6.** If IG has produced fewer than 3 qualified coach conversations while costing more founder time per conversation than DM outreach, cut it to credibility-only: one post a fortnight, no reels, no cadence pressure. Do not keep paying the volume tax for a channel that isn't converting. If it clears 6, promote it to a primary discovery channel and revise `advertising-strategy-v1.md`.

## 3. Audience weighting

Both tracks from `social-design-prompt-v1.md`, weighted toward the bottleneck:

- **Track B (coaches) — 60%.** The discovery priority.
- **Track A (athletes / self-coached AI users) — 40%.** They're the ones who make a reel travel, and they're the clients coaches bring. Track A content does the reach work that gets Track B content seen.

This isn't a compromise — it's the mechanism. Athlete-facing reels earn the reach; coach-facing carousels and posters convert the profile tap.

## 4. What each format is for

**Reels — the discovery engine.** The only format on IG with meaningful non-follower reach. Every reel exists to get a coach or an athlete to comment or DM. Reels are allowed to be rougher than the grid: screen recordings, plain captions, no poster treatment. They do not have to match the feed aesthetic, and you should not let aesthetic standards throttle reel volume. Hook in the first 1.5 seconds, 15–35 seconds long, readable with sound off, always end on a question or an ask.

**Carousels — the save-and-explain format.** Where the mechanism gets explained properly. Slide 1 is a poster; slides 2–7 are utility-face explanation; the last slide is the ask. Carousels are what a coach sends to another coach.

**Static posters — the identity layer.** Produced from `social-design-prompt-v1.md`. These make the grid look authored rather than assembled. Low frequency, high polish. They convince, they don't reach.

**Stories — the warm layer.** Dogfooding, build-in-public, and — most valuably — the discovery questions as polls and question stickers. Near-zero production cost, expire in 24 hours, and they're the most natural bridge into a DM. Story replies land straight in your inbox as a conversation, which is exactly what the sprint needs.

## 5. Content pillars

Six pillars. Every post declares one.

**P1 — The reconstruction problem (Track B, coach).** The check-in arrives in six places; the decision needs one. Concrete, unglamorous, specific to online coaching. *Formats: reel, carousel, poster.* **Highest priority pillar.**

**P2 — Open research (Track B).** You are visibly researching how coaches work, and asking them. Not a pitch. This is the sprint's approved interview questions turned into content: "Where does your client's week actually arrive?" "What do you do manually before you change a plan?" Honest, flattering to the respondent, and the single most direct route to a DM. *Formats: reel, story poll/question sticker.*

**P3 — The loop, shown (Track A).** The real app on screen: messy log in, parsed, corrected, confirmed, exported as context, pasted into an AI that now answers with your actual history. This is the 30-second consumer demo from `docs/product/appeal-improvement-roadmap.md`. It is the most convincing thing you own. *Formats: reel, carousel.*

**P4 — Data ownership and uncertainty (both tracks).** Local-first, export, delete, and the stance that a guess should look like a guess. This is the tribe-building pillar and the differentiator no fitness app claims. *Formats: poster, carousel, reel.*

**P5 — Dogfood (Track A).** Your own training, logged honestly, including the weeks it goes badly. Proof of use without a traction claim. *Formats: story, poster, occasional reel.*

**P6 — Build in public (both).** What shipped, what broke, what you decided and why. The ICP is technical; this is what makes them trust the project. Includes the meta-story of an agent-run marketing system, which is itself interesting to this audience. *Formats: story, poster, carousel.*

Rough mix per month: P1 25%, P2 20%, P3 20%, P4 15%, P5 10%, P6 10%.

## 6. Cadence and production

**The commitment (floor).** Miss this and the page reads as abandoned:

- 2 reels / week
- 1 grid post / week (poster or carousel, alternating)
- Stories on 3 days / week
- Reply to every comment and story reply within 24h — this is where conversations start, and it matters more than the posting itself

**The ceiling.** 3 reels + 2 grid posts. Only when a batch session runs long and you're ahead.

**Production model — one batch session per week, ~90 minutes.**

| Step | Time | Notes |
|---|---|---|
| Screen-record 3–4 raw clips of the real app | 20 min | Log, correct, confirm, export, paste-to-AI. Record more than you need. |
| Cut and caption 2 reels | 30 min | Captions burned in, sound-off readable. |
| Generate the week's grid post | 20 min | Run a brief through `social-design-prompt-v1.md`. |
| Write captions + alt text for all | 20 min | Founder voice. Draft can be agent-prepared; founder edits. |

Stories are not batched — they're same-day and should stay unpolished.

**Weekly slotting**, fitting the existing rhythm in `execution-calendar-v1.md` (which already owns Tue/Thu for X):

| Day | IG action |
|---|---|
| Mon | Batch production session; queue the week |
| Tue | Reel 1 (usually P2 or P3 — the reach-seeking one) |
| Wed | Story: dogfood or discovery poll |
| Thu | Grid post (poster or carousel) |
| Fri | Reel 2 (usually P1, coach-facing) + story: build-in-public |
| Sat/Sun | Replies only. No publishing. |

## 7. First six weeks

Weeks 1–2 establish credibility so the profile tap survives. Weeks 3–6 push discovery.

**Week 1 — the grid exists.** Publish three posters back-to-back so the profile isn't empty on first visit: A1 (the pain), B1 (six places), A3 (data ownership). Then reel R1 and carousel C1. Bio, highlights, and avatar live before anything posts.

**Week 2 — the loop is shown.** Reel R2 (the full loop demo, your flagship), reel R3, carousel C2. First discovery story poll.

**Week 3 — open research begins.** Reel R4 and R5 (both P2, question-led). Poster B2. This is the week DMs should start; leave capacity to reply.

**Week 4 — utility.** Carousel C3 (the genuinely useful, sendable one), reel R6, poster B3. Review: are the accounts engaging actually coaches?

**Week 5 — depth.** Carousel C4, reels R7 and R8. Poster A2.

**Week 6 — decision.** Reel R9, carousel C5. Then run the §2 kill/scale rule and write the memo.

## 8. Post bank

Poster briefs A1–A4 and B1–B4 already exist in `social-design-prompt-v1.md`. New briefs below. All copy must clear §11.

### Reels

**R1 — Six places.** *P1, Track B.* Open on six app icons or six message fragments filling the screen in 2 seconds. Voiceover or caption: "This is one client's week." Cut to a single reviewable summary. Close: "Coaches — how many places does your client's week arrive in? I'm counting." Ask for the number in comments.

**R2 — The loop, uncut.** *P3, Track A.* **Flagship.** One unbroken screen recording: type a genuinely messy log ("did legs, felt weak, skipped last set, back a bit tight") → parsed → correct one wrong number → confirm → copy context → paste into Claude → the answer references your actual last session. No cuts, no speed-up. The credibility is in it being one take.

**R3 — Before and after the plan.** *P3, Track A.* Split screen: what your AI was told, versus what actually happened. Caption: "Your AI needs the part that happened after the plan."

**R4 — Question reel: where does it arrive?** *P2, Track B.* You on camera or plain text over a poster background: "I'm talking to online coaches about one thing — what you do between getting a client's check-in and deciding whether to change anything. Not the coaching. The reconstruction. If that's your week, tell me where it arrives." No product mention. No link.

**R5 — Question reel: the manual step.** *P2, Track B.* "Every coach I ask describes a manual step before they change a plan. Scrolling back through WhatsApp. Cross-checking a sheet. What's yours?" Only run this line once you've actually asked coaches — otherwise it's a fabricated claim. If you haven't yet, rephrase to "I'm asking coaches about the manual step..."

**R6 — Delete everything.** *P4, both.* Screen recording of the actual export-then-delete flow, in real time. Caption: "Your training data should leave with you. Here's it leaving." Nothing sells a privacy stance like showing the button work.

**R7 — A guess should look like a guess.** *P4, Track B.* Show the parser flagging an uncertain value rather than filling it in confidently. "Most tools would just pick one. This asks."

**R8 — My worst gym note.** *P5, Track A.* A genuinely terrible real note of yours, parsed on screen. Self-deprecating, honest, no cleanup.

**R9 — What I got wrong this month.** *P6, both.* A real build or positioning decision you reversed. Technical audiences trust this more than any feature demo.

**R10–R12 — reserve slots.** Fill from whatever the DMs surface. Content that answers a question a real coach actually asked outperforms anything planned in advance.

### Carousels

**C1 — What AGym is, in six slides.** *P1+P3.* Slide 1 poster: `TRAINING HAPPENED. NOW MAKE IT USABLE.` Then: the plan exists → the reality doesn't travel → raw log preserved → uncertainty flagged → you confirm → context travels forward. Last slide: what it is not (not a coach, not medical, not automated).

**C2 — Anatomy of a check-in.** *P1, Track B.* One anonymized, invented-but-realistic client week as it actually arrives: voice note, three WhatsApp messages, a sheet row, a missed session never mentioned. Then the same week as one reviewable page. Label the example as illustrative — never present invented data as a real client.

**C3 — How to give ChatGPT your training history.** *P3, Track A.* **The sendable one.** Genuinely useful, works without AGym: what context an AI actually needs, what to include, what it always forgets, why pasting the plan isn't enough. AGym appears once, at the end, as "what I built because I got tired of doing this manually." Utility content earns saves; saves earn reach.

**C4 — Plan versus actual.** *P4.* The data nobody else has: not steps, not heart rate — whether the plan was followed and what changed. Make the case without claiming an outcome.

**C5 — What a coach can and cannot see.** *P4, Track B.* Confirmed outcomes and accepted-plan history, yes. Raw unconfirmed logs and parse drafts, no. Client links by code, client can unlink. This is a trust post, and it's true today.

**C6 — Six months of building, in decisions.** *P6.* The real ADR chain as a story: what got built, what got killed, what got overridden and why.

### Stories (recurring formats, not one-offs)

**S1 — Today's log.** Photo or screenshot of your actual session going into the app. 3× per week.
**S2 — Discovery poll.** One approved research question as a poll or question sticker. "Coaches: where do check-ins arrive? WhatsApp / Sheets / Platform / All of them." Replies land in the DM inbox — that's the point.
**S3 — Shipped.** One thing that went live this week, screenshotted.
**S4 — Broke.** One thing that didn't work. Builds more trust than S3.
**S5 — Reply-forward.** Screenshot an interesting (permissioned, anonymized) reply and respond to it publicly.

## 9. Profile setup — do this before the first post

- **Handle:** consistent with the X handle.
- **Name field:** `AGym — training memory for AI` (the name field is searchable; the handle isn't, much).
- **Bio:** what it is, who it's for, current status. Something like: *Your training happened. Your AI doesn't know. Building the memory layer — raw log in, confirmed context out. Early. Not a coach, not medical.*
- **Link:** the `/coaches` page while coach discovery is the priority; swap to the main page if Track A starts outperforming.
- **Avatar:** brief D1 in `visual-prompts-v1.md` — must read at 48px.
- **Highlights, created empty on day one so the profile has structure:** `THE LOOP` · `FOR COACHES` · `PRIVACY` · `BUILD LOG` · `MY TRAINING`.
- **Pinned three posts** (the first thing a tapped profile shows): C1 (what it is), R2 (the loop working), B1 (the coach problem). Update whenever something outperforms.

## 10. How this feeds coach discovery — and its limits

The sequence that makes IG worth the time:

```
coach sees a P2 question reel → comments or replies to a story
→ founder replies in thread, genuinely, no pitch
→ founder DMs, referencing what they said, no link
→ interview per the approved guide → ledger entry
```

The standing rules do not relax on Instagram:

- The founder sends every DM, comment, and reply. No automation, no scheduling tools that auto-reply, no bought engagement.
- No demo link in a DM until a coach has confirmed relevant pain and the founder has approved the follow-up.
- Do not request identifiable client data. If a coach volunteers an example, ask them to anonymize it and keep it out of the repository.
- Log every conversation in the sprint's evidence ledger with its evidence strength. A comment or a like is not evidence of demand.

**Approval required before any of this runs.** `experiments/2026-08-01-coach-discovery-sprint-v1.md` states: *no public promotion beyond the approved landing page without a further founder decision.* Launching an Instagram presence is exactly that. Record the decision in the sprint doc and the activity log before the first post, or amend the sprint's boundaries to cover it.

## 11. Claims guardrails — every post, every caption, every reel

Never: medical, diagnostic, injury, or treatment framing; nutrition or exercise prescription; body transformation, weight loss, before/after, physique; hours saved, adherence improved, revenue gained, client outcomes; "AI coach", "personalized AI plans", "automated check-ins", "real-time monitoring"; named third-party integrations; fake testimonials, user counts, or traction; a real client's data, ever.

Always: label illustrative examples as illustrative; carry `Early concept — not a live product` on Track B material; keep the coach's professional judgement explicit; describe only capability that exists today (mobile app, hosted backend, MCP endpoints, coach linking by code, read-only coach dashboard, export/delete).

The uncertainty stance is a content asset, not a disclaimer. "A guess should look like a guess" is more differentiating than any feature claim on this platform.

## 12. What this plan does not solve

- **Cold start is real.** The first month has almost no reach regardless of quality. Reels can bypass it; the grid cannot. Don't read week-1 numbers as signal.
- **IG suppresses links.** Every conversion runs through profile → bio link, or through DMs. Plan for DMs.
- **Coach ICP validation is still at zero.** No interviews are logged. If the sprint's 15 conversations reveal that reconstruction isn't a costly recurring problem, pillars P1 and P2 are wrong and half this plan gets rewritten. That's the correct order of operations — don't let a content calendar create the impression the wedge is validated.
