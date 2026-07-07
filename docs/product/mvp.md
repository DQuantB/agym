# AGym — MVP Product-Loop Specification (v0)
**Component:** Unstructured Logger + Coach Briefing Generator
**Intended path:** `docs/product/mvp.md`
**Status:** Draft v0 — for build validation, not final architecture

---

## 0. Framing

AGym v0 is not a coaching app. It is a thin, trustworthy **read/write memory layer** that lets an external agent (ChatGPT, Claude, a human coach, a spreadsheet workflow — anything) do two things reliably:

1. **Write** a plan into a place the user will actually act against.
2. **Read back** what really happened, in a form an agent can use to generate the next plan.

Everything below exists to make that loop true, cheaply, without overbuilding. If a feature doesn't serve the loop, it's out of v0.

---

## 1. The Canonical Loop

```
agent plan → user action → raw log → parsed event → user correction
   → canonical memory → Coach Briefing / API context → next plan
```

Each stage below is specified independently so any stage can be built, tested, and replaced without breaking the others. The contract between stages is always: **a defined JSON shape in, a defined JSON shape out.**

---

## Stage 1 — Agent Plan (intake)

### 1. Purpose
Give an external agent (or the user pasting an agent's output) a single, low-friction way to hand a plan to AGym so it can be referenced later, and so "what was planned" can be compared against "what happened."

### 2. User action
Pastes or uploads a plan (text, markdown, or JSON) they got from ChatGPT/Claude/a coach. Optionally tags it (e.g., "Week 3 strength block").

### 3. Agent/system action
- Accepts free text or structured JSON via UI paste box or API endpoint (`POST /plans`).
- Attempts light structuring (exercise/day/target fields) but **does not block on parsing success** — an unparsed plan is still stored as raw text.
- Assigns a `plan_id` and timestamps it.

### 4. Input data
Free text, markdown, or JSON blob; optional label/tag; optional source agent name (freeform string, e.g. "ChatGPT").

### 5. Output data
```json
{
  "plan_id": "uuid",
  "created_at": "iso8601",
  "source": "string|null",
  "label": "string|null",
  "raw_plan_text": "string",
  "parsed_plan": { "...best-effort structure or null" }
}
```

### 6. UI requirements
- One textarea + "Save Plan" button. Nothing else.
- Optional label field.
- Confirmation toast; link to view plan later.

### 7. Data fields needed
`plan_id`, `user_id`, `created_at`, `source`, `label`, `raw_plan_text`, `parsed_plan` (nullable).

### 8. What should be stored
Raw plan text, best-effort parse, metadata (timestamps, source label).

### 9. What should not be stored
No attempt to validate medical/nutritional safety of the plan. No enrichment against third-party exercise databases in v0.

### 10. Uncertainty/failure modes
- Plan text is ambiguous or partial → store raw only, `parsed_plan: null`, flag `needs_structuring: true`.
- Duplicate/near-duplicate plan pasted twice → allow it; dedupe is a v1 problem.

### 11. Privacy/consent implications
Plan text may contain the user's health goals or conditions incidentally (e.g. "modified for my knee injury"). Treat plan storage under the same consent umbrella as logs (see Stage 6).

### 12. Acceptance criteria
- A user can paste a plan and see it saved in <5 seconds.
- Plan is retrievable by `plan_id` and shows up in a simple list view.
- No parsing failure ever blocks save.

---

## Stage 2 — User Action (real world)

### 1. Purpose
This is the actual workout/meal/sleep/etc. happening in the world. AGym does not observe this directly — it is the gap the rest of the loop is designed to capture honestly.

### 2. User action
Trains, eats, sleeps, recovers — normal life. No app interaction required at this stage.

### 3. Agent/system action
None. This stage is explicitly outside system reach. Do not attempt wearable/sensor integration in v0 — it's a trap that turns a data-loop MVP into a hardware-integration project.

### 4–9. Input/output/UI/fields/storage
N/A — nothing is captured until Stage 3.

### 10. Uncertainty/failure modes
The fundamental and permanent failure mode of self-report systems: what's logged ≠ what happened. v0's job is not to eliminate this gap, but to **make correction cheap** so the gap shrinks over time (see Stage 5).

### 11. Privacy/consent implications
None yet — no data exists in the system for this stage.

### 12. Acceptance criteria
N/A (non-digital stage, included for completeness of the loop model).

---

## Stage 3 — Raw Log

### 1. Purpose
Capture what the user says happened, in whatever form is fastest for them — this is the core low-friction entry point and the single most important UX surface in the MVP.

### 2. User action
Types or pastes messy free text: *"did legs today, squats felt heavy, only got 3x5 at 80kg, skipped cardio, slept like crap, ate out twice."* Optionally attaches a date if not "today."

### 3. Agent/system action
- Accepts raw text via textarea or API (`POST /logs`).
- Timestamps immediately.
- Queues for parsing (Stage 4) but **returns success to the user instantly** — parsing is async and never blocks the save.

### 4. Input data
Freeform text string. Optional explicit date/time override. Optional log-type hint (workout/meal/sleep/mood/other) — optional, not required.

### 5. Output data
```json
{
  "log_id": "uuid",
  "created_at": "iso8601",
  "logged_for_date": "date",
  "raw_text": "string",
  "status": "pending_parse"
}
```

### 6. UI requirements
- Single large textarea, always visible, always the first thing the user sees on open.
- One primary button: "Log it."
- No required fields, no dropdowns, no forced categorization.
- Instant confirmation (not a loading spinner) — the raw text is safe the moment it's typed.

### 7. Data fields needed
`log_id`, `user_id`, `created_at`, `logged_for_date`, `raw_text`, `status`.

### 8. What should be stored
The exact raw text, verbatim, permanently (until user deletes it), with timestamps.

### 9. What should not be stored
- Device metadata beyond what's needed for timestamping (no location, no device fingerprinting).
- No auto-tagging with sensitive inferred labels (e.g. inferring an eating disorder or mental health condition from text) — flag for human review instead, never silently label.

### 10. Uncertainty/failure modes
- Empty or gibberish input → accept anyway, let parser mark it `unparseable`.
- User logs for the wrong date → correctable in Stage 5, not a Stage 3 concern.

### 11. Privacy/consent implications
This is the most sensitive data surface in the app (free text about body, health, sometimes mental state). Store encrypted at rest. Make deletion (Stage-level, not just account-level) available from day one — see global export/delete section below.

### 12. Acceptance criteria
- Typing and submitting a log takes <10 seconds end to end.
- Raw text is never lost, even if parsing later fails entirely.
- A user can log without ever seeing a schema, field, or category.

---

## Stage 4 — Parsed Event

### 1. Purpose
Convert messy text into structured, queryable data — the bridge between human language and machine-usable memory.

### 2. User action
None required yet — this happens automatically after Stage 3. User will review the result in Stage 5.

### 3. Agent/system action
- LLM call parses `raw_text` into one or more structured "events" (a single raw log can yield multiple events, e.g. a workout event + a sleep event + a nutrition note).
- Each extracted field gets a **confidence flag**, not just a value.
- Parser explicitly attempts to map against the most recent open plan (Stage 1) if one exists, to note plan-vs-actual deltas — but this mapping is best-effort and itself uncertainty-flagged.

### 4. Input data
`raw_text` from Stage 3; optionally the most recent relevant `parsed_plan` for cross-referencing.

### 5. Output data
```json
{
  "event_id": "uuid",
  "log_id": "uuid (source)",
  "event_type": "workout | nutrition | sleep | recovery | mood | other",
  "date": "date",
  "fields": {
    "exercise": "back squat",
    "sets": 3,
    "reps": 5,
    "load_kg": 80,
    "rpe": null
  },
  "plan_ref": "plan_id|null",
  "confidence": {
    "exercise": "high",
    "sets": "high",
    "reps": "high",
    "load_kg": "medium",
    "rpe": "unknown"
  },
  "parse_status": "parsed | partial | failed"
}
```

### 6. UI requirements
None directly — this stage is invisible to the user except as input to Stage 5's editable preview.

### 7. Data fields needed
`event_id`, `log_id`, `event_type`, `date`, `fields` (schema varies by type — see below), `plan_ref`, `confidence` map, `parse_status`.

Minimal per-type field sets for v0:
- **Workout event:** exercise, sets, reps, load, unit, perceived_effort (optional)
- **Nutrition event:** meal_description, meal_type (optional), notes
- **Sleep event:** duration_hours (optional), quality_note
- **Recovery/mood event:** free_text_note, self_rated_scale (optional)

### 8. What should be stored
The structured `parsed_event` linked back to its source `log_id`, with confidence flags intact — confidence is a first-class field, not metadata that gets discarded.

### 9. What should not be stored
- No inferred diagnoses, no inferred medical conditions, no inferred body composition estimates the user didn't state.
- No silent "auto-corrections" that overwrite what the user actually wrote — the parser proposes, it never finalizes without Stage 5.

### 10. Uncertainty/failure modes
- Ambiguous units (kg vs lb), ambiguous exercise names, multiple activities in one log, sarcasm/idiom ("died today" ≠ medical event) → all should degrade to `confidence: low` or `parse_status: partial`, never to a silently wrong high-confidence value.
- Total parse failure → still create a stub event with `parse_status: failed` and raw text attached, so it can be manually completed in Stage 5.

### 11. Privacy/consent implications
Parsing may run through a third-party LLM API. This must be disclosed clearly in onboarding/consent (see Stage 6). No log content should be used to train third-party foundation models without separate, explicit, revocable consent.

### 12. Acceptance criteria
- >80% of clearly-written workout logs parse into correct structured fields on first pass (measured in prototype week).
- Every field has a confidence value; nothing is "confidently" wrong more than it's "flagged" uncertain.
- Failed parses never silently disappear — they always surface in Stage 5.

---

## Stage 5 — User Correction

### 1. Purpose
This is where trust in the system is actually built or destroyed. The user gets final say over their own canonical record, cheaply and fast.

### 2. User action
Reviews an editable preview of the parsed event(s), fixes anything wrong (wrong number, wrong exercise, wrong date), and confirms.

### 3. Agent/system action
- Presents parsed fields as editable form fields, pre-filled, with low-confidence fields visually flagged (e.g. subtle highlight + "not sure about this").
- On confirm, marks the event `user_confirmed: true`, timestamps the confirmation, and freezes it into canonical memory (Stage 6).
- If user edits a field, log both the parser's original value and the corrected value (for parser-quality feedback loops later — not shown to user, internal only).

### 4. Input data
Parsed event JSON from Stage 4; user edits via form.

### 5. Output data
```json
{
  "event_id": "uuid",
  "user_confirmed": true,
  "confirmed_at": "iso8601",
  "final_fields": { "...corrected values" },
  "correction_diff": { "field": ["parsed_value", "corrected_value"] }
}
```

### 6. UI requirements
- Simple editable card per event: field labels, editable inputs, a visible "not sure" badge on low-confidence fields.
- One-tap "Looks good" to confirm without editing.
- Inline edit, not a separate screen — minimize taps.
- Batch confirm if a raw log produced multiple events.

### 7. Data fields needed
`event_id`, `user_confirmed`, `confirmed_at`, `final_fields`, `correction_diff` (internal only).

### 8. What should be stored
Final corrected fields as the source of truth going forward. The diff between parsed and corrected (for internal parser-improvement analytics only, not user-facing in v0).

### 9. What should not be stored
Don't store editorializing about *why* the user corrected something unless they volunteer it — no inferred "user is in denial about progress" style annotations. Ever.

### 10. Uncertainty/failure modes
- User ignores/never confirms → event sits as `unconfirmed`; should still be usable in Stage 7 briefings but clearly marked as unverified, never presented with the same confidence as confirmed data.
- User over-corrects out of fatigue (just clicks confirm without reading) → accept this as a known limitation; not solvable in v0, worth measuring in prototype (time-to-confirm as a proxy for engagement quality).

### 11. Privacy/consent implications
This is the moment the user should understand: "this is now your permanent record, here's how to edit/delete it later." Consider a one-line reminder near the confirm button in early versions, not a full modal every time.

### 12. Acceptance criteria
- Correcting a wrong field takes <2 taps/edits.
- Confirmed data is never silently altered afterward outside explicit user edit.
- A raw log → confirmed event round trip is achievable in under 60 seconds for a typical workout log.

---

## Stage 6 — Canonical Memory

### 1. Purpose
The permanent, structured, user-owned record — the actual product moat. Everything upstream is UX to get clean data in; everything downstream is UX to get useful context out.

### 2. User action
None directly — passive stage. User may browse/search their own history here.

### 3. Agent/system action
- Appends confirmed (and clearly-marked unconfirmed) events to a durable per-user event store.
- Never mutates history in place except via explicit user-initiated edit/delete — canonical memory is append-and-correct, not silently rewritten.
- Indexes by date, event_type, and plan_ref for later retrieval.

### 4. Input data
Confirmed events from Stage 5 (plus optionally aged-out unconfirmed events, clearly flagged).

### 5. Output data
The canonical event store itself — the queryable dataset underlying Stages 7 and future API reads.

### 6. UI requirements
- A simple chronological history view (list, filterable by type/date).
- Per-event view/edit/delete affordance.
- No dashboards, no charts, no analytics in v0 — that's explicitly a later, consented-data-tier feature.

### 7. Data fields needed
All fields from Stage 5's `final_fields`, plus `event_type`, `date`, `plan_ref`, `confirmed` boolean, `created_at`, `updated_at`, `deleted_at` (soft delete flag).

### 8. What should be stored
The full corrected event history, indefinitely, until user-initiated deletion. This is the product's core asset and must be treated with the highest data-integrity bar in the system.

### 9. What should not be stored
- No cross-user aggregation or benchmarking in v0 (that's the explicitly-consented future tier mentioned in the thesis, not MVP).
- No behavioral inference layers (adherence scoring, "motivation profiles," etc.) — v0 is memory, not judgment.

### 10. Uncertainty/failure modes
- Conflicting entries for the same date/event (user logs twice, differently) → keep both, timestamp both, let the briefing generator (Stage 7) surface the conflict rather than silently picking one.

### 11. Privacy/consent implications
This is the core "user-owned data layer" promise from the thesis — so:
- Data must be exportable in full, in a standard format (JSON), on demand.
- Data must be deletable in full, on demand, with a real deletion (not just a hidden flag) within a stated SLA (e.g. 30 days).
- No data leaves this store for benchmarking/model-training/dashboard purposes without a separate, explicit, opt-in consent action — never bundled into general ToS acceptance.

### 12. Acceptance criteria
- A user can export their entire canonical history as JSON in one action.
- A user can delete a specific event or their entire history in one action, and it's actually gone.
- Canonical memory query (by date range) returns in <1s for a single user's data at MVP scale.

---

## Stage 7 — Coach Briefing / API Context

### 1. Purpose
Turn canonical memory into something an agent (or human coach) can immediately use to write the next plan — this is the "read back" half of the micro-app contract and the actual deliverable of the MVP.

### 2. User action
Requests a briefing ("Generate my Coach Briefing for the last 7 days") or an agent requests it via API on the user's behalf (with the user's authorization).

### 3. Agent/system action
- Aggregates canonical events over a requested window.
- Produces two outputs: (a) a human-readable markdown Coach Briefing, and (b) a machine-readable JSON context object for direct agent consumption.
- Surfaces plan-vs-actual deltas where `plan_ref` links exist.
- Explicitly carries forward uncertainty flags and unconfirmed-event flags into the briefing — never launders low-confidence data into confident-sounding prose.
- Includes a mandatory disclaimer block: not medical advice, not a diagnosis, user-reported data only.

### 4. Input data
Canonical events for the requested window/user; linked plans where available.

### 5. Output data
Markdown briefing (human-facing) + JSON context object (agent-facing):
```json
{
  "briefing_id": "uuid",
  "user_id": "uuid",
  "window": {"start": "date", "end": "date"},
  "summary": "string (short, plain-language)",
  "events": [ "...canonical events in window" ],
  "plan_vs_actual": [ {"plan_id": "...", "deltas": "..."} ],
  "flags": ["unconfirmed_events_present", "low_confidence_fields_present"],
  "disclaimer": "User-reported data only. Not medical advice."
}
```

### 6. UI requirements
- One button: "Generate Briefing" with a date-range picker (default: last 7 days).
- Rendered markdown view with a "Copy" and "Download" action.
- A visible, non-dismissible disclaimer line at the top of every briefing.
- API endpoint (`GET /briefing?window=...`) mirrors the same content in JSON for agent use.

### 7. Data fields needed
`briefing_id`, `user_id`, `window`, `summary`, `events[]`, `plan_vs_actual[]`, `flags[]`, `disclaimer`, `generated_at`.

### 8. What should be stored
The generated briefing itself (for user's own history/reference), linked to the event set it was built from.

### 9. What should not be stored
No speculative recommendations authored by AGym itself — the briefing summarizes what happened, it does not prescribe what to do next. Prescribing is the downstream agent's job, explicitly out of scope here (see thesis: "not another generic AI coach").

### 10. Uncertainty/failure modes
- Sparse data window (few/no logs) → briefing must say so plainly ("Limited data this period") rather than padding with generic filler.
- Conflicting/duplicate events → surfaced as an explicit flag in the briefing, not resolved silently.

### 11. Privacy/consent implications
If an agent is pulling this via API on the user's behalf, the user must have explicitly authorized that agent/integration (token-based, revocable access — not implicit "any LLM can read this"). Every briefing/API pull should be logged (who/what accessed, when) and visible to the user in an access log.

### 12. Acceptance criteria
- A 7-day briefing generates in <10 seconds.
- Briefing content is fully traceable back to specific canonical events (no unsourced claims).
- JSON and markdown outputs are content-equivalent (same underlying data, different presentation).
- Disclaimer is present on 100% of generated briefings, no exceptions.

---

## Stage 8 — Next Plan

### 1. Purpose
Closes the loop: the agent (ChatGPT, Claude, a human coach) consumes the briefing/JSON context and produces the next plan, which flows back into Stage 1.

### 2. User action
Takes the briefing (or grants API access) to their agent of choice, asks for the next plan, then pastes/syncs it back into AGym.

### 3. Agent/system action
AGym's role here is minimal by design: provide the context, accept the resulting plan back at Stage 1. AGym does not generate the plan itself in v0 — that would make it "another generic AI coach," which is explicitly out of scope.

### 4–9. Input/output/UI/fields/storage
Mirrors Stage 1 exactly — this is the loop closing, not a new stage.

### 10. Uncertainty/failure modes
User may take the briefing to an agent and never bring the resulting plan back → loop breaks. This is a real adoption risk, not a technical one; the shortest fix is UX nudges ("paste your new plan here") rather than trying to auto-integrate with every possible agent in v0.

### 11. Privacy/consent implications
If AGym ever offers a direct API bridge to a specific agent (e.g. a Claude/ChatGPT plugin) that both reads briefing and writes plan automatically, that bridge needs its own explicit consent scope, separate from basic account consent.

### 12. Acceptance criteria
A user can go from "generate briefing" → "get new plan from their agent" → "paste new plan into AGym" in under 5 minutes, without leaving their normal agent workflow for more than that.

---

## What the MVP Includes

- Raw text logger (single textarea, instant save)
- LLM-based parser (log → structured event, with confidence flags)
- Editable preview + user confirmation flow
- Canonical event store (append + correct, never silently mutate)
- Plan intake box (paste raw or structured plan, linked to a `plan_id`)
- Coach Briefing generator (markdown, human-readable)
- JSON context export mirroring the briefing (basic API or downloadable file)
- Full data export (JSON) and full/partial delete, self-serve
- Basic auth/account + per-user data isolation
- Consent screens covering: third-party LLM parsing, any future benchmarking/aggregation (opt-in, off by default)
- Access log for any API/agent reads of a user's data

## What the MVP Explicitly Excludes

- No wearable/sensor integrations
- No charts, dashboards, trends, or analytics visualizations
- No AI-generated recommendations, plans, or coaching advice authored by AGym itself
- No social features, sharing, leaderboards, or community
- No multi-agent orchestration or plugin marketplace
- No cross-user benchmarking, cohort comparison, or "vertical fitness model" training pipeline (explicitly future, explicitly consent-gated, explicitly not v0)
- No mobile app — a responsive web app is sufficient for validation
- No native calendar/notification/reminder system
- No medical/diagnostic claims or features of any kind

## The Shortest Useful Vertical Slice

To validate the loop with the least possible build:

1. One user.
2. Paste a plan (raw text is fine — skip structured parsing of plans entirely for the first slice).
3. Log 3–5 raw text entries over a few days.
4. Parse → editable preview → confirm, for each.
5. Generate one markdown Coach Briefing covering that window.
6. Manually take that briefing to ChatGPT/Claude, get a next plan, paste it back in as a new plan.

If steps 1–6 can be done end to end without the builder writing custom code per user, the loop is validated. Everything else (API, access logs, multi-user auth hardening, nicer UI) is second-order.

## Risks of Overbuilding

- **Building the parser to be "perfect" before shipping.** A parser that's honest about uncertainty and lets the user correct fast beats a parser that tries to be right the first time. Confidence flags + fast correction UX matter more than parsing accuracy in v0.
- **Adding dashboards/analytics early.** They feel like "obvious value" but they're a distraction from validating that the write→read loop itself works and that users will actually do the correction step.
- **Building the API/integration layer before the manual loop is proven.** If users won't paste a briefing into ChatGPT manually, they won't set up an API integration either. Manual-first de-risks the harder engineering investment.
- **Trying to support every possible log type (supplements, injuries, mood, HRV, etc.) on day one.** Workout + basic nutrition/sleep/mood free text covers the validation need; expand types after the loop is proven.
- **Solving multi-agent auth/plugin ecosystems before there's a single agent integration that actually works well.** One clean manual copy/paste loop first; automate the best-performing path second.
- **Premature data-monetization infrastructure** (benchmarking pipelines, model training hooks) before there's enough longitudinal, consented data to make that meaningful — and before trust in the core loop is established. Building this early also creates unnecessary privacy/legal surface area for an unvalidated product.

## First 7-Day Prototype Plan

**Day 1 — Skeleton & auth**
Basic web app shell, single-user auth (can be a static test account for prototype), empty log/plan/briefing views wired up but non-functional.

**Day 2 — Raw logger**
Ship the textarea logger end to end: type text → save → appears in a raw log list. No parsing yet. This alone should be demoable.

**Day 3 — Parser v0**
Wire an LLM call that takes raw text and returns structured JSON with confidence flags for at least one event type (workout). Test against 10–15 real messy sample logs.

**Day 4 — Editable preview + confirmation**
Build the correction UI: parsed fields shown editable, confirm button, writes to canonical store. Test the full raw-log → confirmed-event path yourself with real logs.

**Day 5 — Plan intake + canonical history view**
Add the plan paste box (Stage 1) and a simple chronological history view of canonical events (Stage 6), filterable by date.

**Day 6 — Coach Briefing generator**
Build the aggregation + markdown generation for a 7-day window, including the plan-vs-actual delta where a `plan_ref` exists, and the mandatory disclaimer. Add JSON export alongside markdown.

**Day 7 — Dogfood the full loop**
Personally run the entire loop at least twice: paste a plan → log for a few days → confirm events → generate briefing → take briefing to ChatGPT/Claude → get next plan → paste it back in. Note every friction point. This is the actual validation, not the code.

---

*End of v0 spec. Save as `docs/product/mvp.md`.*
