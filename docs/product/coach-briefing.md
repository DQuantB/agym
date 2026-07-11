# AGym — Coach Briefing v0
**Intended path:** `docs/product/coach-briefing.md`
**Status:** REFERENCE for templates/tone only. The **authoritative v0 output standard is `docs/briefing/coach-briefing-v0-standard.md`** (sections, order, disclaimer, quoting rules), with behavior rules in `docs/architecture/v0-schema-deltas.md` §5. Both win on any conflict with this doc (e.g. briefings are generated on demand, not stored).

---

## 0. What this document is

The Coach Briefing is the single most important surface AGym produces. It's the "read back" half of the micro-app contract — the thing a user pastes into ChatGPT/Claude/Gemini, hands to a human coach, or (later) exposes via API/MCP so an agent can pull it directly.

It has to work **before AGym has a polished app** — meaning it has to be legible as plain markdown, copy-pasteable, and self-explanatory to an agent or human who has never seen AGym before and has zero other context. That constraint shapes every decision below.

Four formats exist because they serve different consumers:

| Format | Consumer | When to use |
|---|---|---|
| Short markdown | Any chat-based agent, quick check-in | Default — most weekly loop-closing happens here |
| Long markdown | Human coach, deeper planning session | When more context genuinely changes the next plan |
| JSON context | API/MCP-connected agent | Machine consumption, no prose parsing needed |
| Privacy-safe | Any third party, screenshots, sharing in communities | Strips identity + sensitive fields, keeps training-relevant structure |

All four are generated from the **same underlying `canonical_event` set** for a given window — never independently authored. This is what keeps them honest with each other.

---

## 1. Short Markdown Version (template)

Use this as the default. Target length: readable in under 30 seconds, short enough that a user will actually copy-paste it every week without friction.

```markdown
# Coach Briefing — {{user_display_name}} — {{window_start}} to {{window_end}}

**Disclaimer:** User-reported data only. Not medical advice. AGym does not diagnose or assess injury/illness.

## Summary
{{1-3 sentence plain-language summary of the window}}

## Training
{{bulleted list of confirmed sessions, with plan-vs-actual noted where available}}

## Nutrition / Sleep / Body
{{bulleted list, only include categories with actual data this window}}

## ⚠ Flags
{{any pain/safety flags, specialist restrictions, or unresolved/contradictory logs — omit this section entirely if empty, never show "no flags" as filler}}

## Data quality note
{{one line noting confirmed vs. unconfirmed counts, and any low-confidence fields worth knowing about}}

---
*Ask your coach:* {{suggested final question, see Section 11}}
```

---

## 2. Long Markdown Version (template)

Use when a human coach or an agent doing deeper program design needs the fuller picture — a full week+ of context, plan history, and specific numbers, not just a summary.

```markdown
# Coach Briefing (Full) — {{user_display_name}} — {{window_start}} to {{window_end}}

**Disclaimer:** This briefing reflects user-reported data only, reviewed and confirmed by the user. AGym does not diagnose, assess medical risk, or make treatment recommendations. Any flags below are user-reported symptoms, not clinical assessments.

## 1. Overview
{{2-4 sentence narrative summary}}

## 2. Active Plan Context
- **Current plan:** {{plan label, source (agent/specialist/self), date started}}
- **Plan type:** {{agent_written_plan | human_specialist_plan | self_authored}}
{{if human_specialist_plan or has an active restriction, show it prominently here, e.g.:}}
- **⚠ Active restriction (physiotherapist, review due {{date}}):** {{constraint_text verbatim}}

## 3. Training Log ({{window_start}}–{{window_end}})
| Date | Session | Planned | Actual | Note |
|---|---|---|---|---|
{{one row per workout_session/running_event, with plan_item comparison where linked}}

## 4. Nutrition
{{list of meal_events with food_items, portion-confidence noted; omit if no logs this window}}

## 5. Recovery
{{sleep/mood entries, with duration_is_estimate flagged}}

## 6. Body Metrics
{{weight/other trend, with prior-value cross-check noted}}

## 7. ⚠ Pain / Safety Flags
{{full detail per pain_event: body part, symptom description, sessions affected, user-stated intent — never a diagnosis or severity assessment. Omit section entirely if none active.}}

## 8. Plan vs. Reality
{{adherence_record if present, self-reported vs computed distinguished; explicit deviations list}}

## 9. Data Quality
- Confirmed events: {{n}}
- Unconfirmed/pending events: {{n}}
- Low-confidence fields this window: {{list or "none"}}
- Unresolved/contradictory logs: {{list or "none"}}

## 10. Access Log
{{who/what has read this data recently — see agent_run — only included if the user has requested this level of detail}}

---
*Ask your coach:* {{suggested final question, see Section 11}}
```

---

## 3. JSON Context Version (schema-aligned)

This mirrors the `coach_briefing` object from `docs/architecture/schemas.md` directly — no separate schema to maintain. This is what an API/MCP-connected agent consumes; it should never need to parse the markdown.

```json
{
  "id": "uuid",
  "user_id": "uuid",
  "window_start": "date",
  "window_end": "date",
  "generated_at": "iso8601",
  "disclaimer": "User-reported data only. Not medical advice. AGym does not diagnose or assess injury/illness.",
  "summary": "string, plain language, 1-3 sentences",
  "active_plan": {
    "plan_id": "uuid|null",
    "label": "string|null",
    "provenance": "agent_written_plan|human_specialist_plan|raw_self_report|null",
    "active_restriction": "string|null"
  },
  "events": [
    {
      "canonical_event_id": "uuid",
      "event_type": "workout|cardio|nutrition|sleep|mood|body_metric|pain_flag|period_summary",
      "date": "date",
      "provenance": "user_confirmed|specialist_verified|derived_metric",
      "confidence_notes": { "field_name": "confidence_level" },
      "detail": { "...typed fields from workout_session/exercise_set/meal_event/etc." }
    }
  ],
  "plan_vs_actual": [
    { "plan_item_id": "uuid", "planned": {}, "actual": {}, "delta_note": "string" }
  ],
  "flags": [
    "unconfirmed_events_present",
    "low_confidence_fields_present",
    "contradictory_log_unresolved",
    "pain_flag_active",
    "specialist_restriction_active"
  ],
  "pain_flags": [
    { "body_part": "string", "symptom_description": "string", "user_stated_intent": "string|null", "medical_caution_triggered": "boolean" }
  ],
  "adherence": {
    "provenance": "raw_self_report|derived_metric",
    "value_pct": "number|null",
    "deviations": [ { "planned": "string", "actual": "string", "reason": "string|null" } ]
  },
  "data_quality": {
    "confirmed_count": "number",
    "unconfirmed_count": "number",
    "low_confidence_field_count": "number"
  },
  "suggested_question_for_coach": "string"
}
```

---

## 4. Privacy-Safe Version (template)

Use when the briefing might be shared somewhere less trusted than a direct 1:1 agent conversation — a community post asking for feedback, a screenshot, a third-party tool without a data agreement. Strips identity and reduces precision on sensitive fields while keeping the structure useful.

**Transformations applied:**
- `user_display_name` → removed entirely (no placeholder name either)
- Exact dates → relative labels ("this week," "3 days ago")
- Exact body weight values → trend direction + rough magnitude only ("down slightly," not "82.4kg")
- Pain/safety flags → kept (safety-relevant) but stripped of anything that could identify the person, and kept at the same non-diagnostic framing
- Specialist plan source → generalized ("a physiotherapist," not a named clinician if one was captured)
- Access log section → removed entirely

```markdown
# Coach Briefing (Shareable) — this week

**Disclaimer:** User-reported data only. Not medical advice. AGym does not diagnose or assess injury/illness.

## Summary
{{same summary language, no identity, no exact dates}}

## Training
{{same structure, relative dates}}

## ⚠ Flags
{{same flag content, generalized specialist references, no identifying detail}}

## Data quality note
{{unchanged — this is useful precisely because it's not identity-linked}}

---
*Ask your coach:* {{same suggested question}}
```

---

## 5. Example Coach Briefing (fake data)

Fake user: **"Jordan"**, window covering a week that includes a modified deadlift session, a skipped leg day, a knee pain flag, and a physio restriction — built from events consistent with the eval set in `evals/agym_v0_samples.json` (eval_02, eval_03, eval_11, eval_17).

### 5a. Short version, filled

```markdown
# Coach Briefing — Jordan — 2026-06-30 to 2026-07-06

**Disclaimer:** User-reported data only. Not medical advice. AGym does not diagnose or assess injury/illness.

## Summary
Trained 3 times this week, one session modified due to reported back tightness, one leg day skipped. A knee pain flag has been active since Wednesday and a physio restriction is in place.

## Training
- Mon: Deadlift — planned 4x6 @ 120kg, actual 3x5 @ 100kg (modified: back tightness)
- Wed: Upper push — bench 4x8 @ 60kg, OHP 3x10 @ 40kg (as planned)
- Fri: Leg day — **skipped** (reason: low motivation)

## ⚠ Flags
- **Active physio restriction** (review due 2026-07-15): no squatting below parallel, avoid loaded knee flexion past ~90°.
- **Pain flag:** right knee, sharp pain toward shin during squats, reported over 2 sessions. User is considering a professional evaluation. This is a self-reported symptom, not an assessed injury.

## Data quality note
3 of 3 logged sessions confirmed. No low-confidence fields flagged this window.

---
*Ask your coach:* Given the current physio restriction and the reported knee pain, can you suggest lower-body alternatives that avoid loaded knee flexion past 90° for the next two weeks, and how should I adjust the rest of my upper-body programming in the meantime?
```

### 5b. JSON version, filled (abbreviated for readability — full version follows Section 3's schema exactly)

```json
{
  "id": "b7f1...",
  "user_id": "5f2c...",
  "window_start": "2026-06-30",
  "window_end": "2026-07-06",
  "generated_at": "2026-07-06T20:00:00Z",
  "disclaimer": "User-reported data only. Not medical advice. AGym does not diagnose or assess injury/illness.",
  "summary": "Trained 3 times this week, one session modified due to reported back tightness, one leg day skipped. A knee pain flag has been active since Wednesday and a physio restriction is in place.",
  "active_plan": {
    "plan_id": "16a7...",
    "label": "Post-appointment physio plan",
    "provenance": "human_specialist_plan",
    "active_restriction": "No squatting below parallel; avoid loaded knee flexion past ~90 degrees for 2 weeks."
  },
  "events": [
    {
      "canonical_event_id": "d802...",
      "event_type": "workout",
      "date": "2026-06-30",
      "provenance": "user_confirmed",
      "confidence_notes": {},
      "detail": { "exercise": "deadlift", "actual": {"sets": 3, "reps": 5, "load_kg": 100}, "planned": {"sets": 4, "reps": 6, "load_kg": 120}, "note": "modified due to back tightness" }
    },
    {
      "canonical_event_id": "d803...",
      "event_type": "workout",
      "date": "2026-07-02",
      "provenance": "user_confirmed",
      "confidence_notes": {},
      "detail": { "session_label": "upper push", "exercises": [{"exercise":"bench press","sets":4,"reps":8,"load_kg":60},{"exercise":"overhead press","sets":3,"reps":10,"load_kg":40}] }
    },
    {
      "canonical_event_id": "d804...",
      "event_type": "workout",
      "date": "2026-07-04",
      "provenance": "user_confirmed",
      "confidence_notes": {},
      "detail": { "session_label": "leg day", "status": "skipped", "note": "not feeling it" }
    }
  ],
  "plan_vs_actual": [
    { "plan_item_id": "17b8...", "planned": {"sets":4,"reps":6,"load_kg":120}, "actual": {"sets":3,"reps":5,"load_kg":100}, "delta_note": "reduced due to back tightness" }
  ],
  "flags": ["pain_flag_active", "specialist_restriction_active"],
  "pain_flags": [
    { "body_part": "right knee", "symptom_description": "sharp pain radiating toward shin during squats", "user_stated_intent": "considering professional evaluation", "medical_caution_triggered": false }
  ],
  "adherence": { "provenance": "raw_self_report", "value_pct": null, "deviations": [] },
  "data_quality": { "confirmed_count": 3, "unconfirmed_count": 0, "low_confidence_field_count": 0 },
  "suggested_question_for_coach": "Given the current physio restriction and the reported knee pain, can you suggest lower-body alternatives that avoid loaded knee flexion past 90° for the next two weeks, and how should I adjust the rest of my upper-body programming in the meantime?"
}
```

### 5c. Privacy-safe version, filled

```markdown
# Coach Briefing (Shareable) — this week

**Disclaimer:** User-reported data only. Not medical advice. AGym does not diagnose or assess injury/illness.

## Summary
Trained 3 times this week, one session modified due to reported back tightness, one session skipped. A knee pain flag has been active for a few days and a physio restriction is in place.

## Training
- Earlier this week: Deadlift — planned 4x6, actual 3x5, lighter load (modified: back tightness)
- Mid-week: Upper push — bench and overhead press, as planned
- Later: Leg day — skipped (low motivation)

## ⚠ Flags
- Active restriction from a physiotherapist: no squatting below parallel, avoid loaded knee flexion past ~90°.
- Pain flag: right knee, sharp pain toward shin during squats, present for a couple of sessions. Considering a professional evaluation. Self-reported symptom, not an assessed injury.

## Data quality note
All logged sessions this week were confirmed by the user. No low-confidence fields.

---
*Ask your coach:* Given a current physio restriction (no squatting below parallel, avoid loaded knee flexion past 90°) and reported knee pain, what lower-body alternatives would you suggest for the next two weeks?
```

---

## 6. Rules for What to Include

- **Only `user_confirmed`, `specialist_verified`, or `derived_metric` events** — anything still `llm_parsed_uncertain` and unconfirmed is either excluded or explicitly labeled as unconfirmed in a separate, clearly-marked section (never blended silently into confirmed content).
- **Active plans and active restrictions**, always, at the top of the long version and folded into the summary of the short version — a briefing that omits an active physio restriction because it's "old news" is a safety failure, not an efficiency win.
- **Plan-vs-actual deltas** wherever a `plan_item_ref` link exists, even when the delta is "hit the plan exactly" — silence there reads as "no plan existed," not "adherence was perfect."
- **Explicit skips**, not just completions — a skipped session is signal (see `workout_session.status: "skipped"`) and belongs in the training log with the same visibility as a completed one.
- **Data quality metadata** (confirmed/unconfirmed counts, low-confidence fields) every time, even when the answer is "all confirmed, nothing low-confidence" — this is what lets the reader calibrate how much to trust the rest of the document.
- **The disclaimer, on every format, every time**, non-negotiably, including the privacy-safe version.
- **A suggested final question** — the briefing's job is to set up the next agent's next plan, not just report the past (see Section 11).

## 7. Rules for What to Exclude

- **No AI-authored recommendations, prescriptions, or "you should" language from AGym itself.** The briefing summarizes what happened and flags what's active; it never tells the reader what to do next. That's the downstream agent's or coach's job, explicitly.
- **No calorie/macro totals or nutrition-quality scoring** — v0's `food_item` schema deliberately has no such fields, so there's nothing to surface here even if asked.
- **No diagnosis, severity assessment, or risk scoring of any pain/safety flag** — the schema has no field for this and the briefing generator must not synthesize one in prose either.
- **No derived psychological/behavioral narrative** ("you seem to struggle with consistency on weekends") — stick to what was logged; if a pattern is worth naming, name the observable fact ("2 of the last 3 weekend sessions were skipped"), not a character judgment about the user.
- **No cross-user comparison or benchmarking** — v0 has no consented cohort data to draw on, and even once it exists, that's a separate consent-gated feature, not something that leaks into the default briefing.
- **No filler "no flags" or "nothing to report" sections displayed as if they were content** — omit empty sections entirely rather than padding the document; an empty flags section still needs to visually disappear, not print "None :)".
- **No access-log detail by default** in the short/privacy-safe versions — only in the long version, and only because a user specifically wants that level of transparency in a deeper coaching session.

## 8. How to Represent Uncertainty

Uncertainty is carried at the field level all the way from `parsed_event.confidence` through to the briefing — it is never resolved into confident prose along the way. Concretely:

- **In markdown:** low/unknown-confidence values get an inline qualifier, not a silent number. *"~5 hours sleep (self-estimated)"*, not *"5 hours sleep."* *"Roughly 1–2 cups of rice (portion not precisely measured)"*, not *"1.5 cups of rice."*
- **In JSON:** every event carries a `confidence_notes` map alongside its `detail` — an agent consuming this can choose to weight or caveat low-confidence fields itself, rather than the briefing making that judgment silently on its behalf.
- **Never invent precision that wasn't logged.** If the user said "maybe 5 hours," the briefing says "~5 hours (estimated)" forever — it does not get quietly promoted to "5 hours" in later briefings just because it's now historical.
- **A "Data quality" section is mandatory** in every format specifically so uncertainty has a designated home rather than being sprinkled unevenly through prose and easy to miss.
- **Self-reported summaries (adherence %, weekly recaps) are visually and structurally distinguished from event-level logs** — they're a different, lower-precision data type, and the briefing says so explicitly ("this is a self-estimate; compare against the individual sessions above").

## 9. How to Represent Pain/Safety Flags Without Medical Claims

- **Report the symptom in the user's own words, minimally reworded** — "sharp pain radiating toward the shin during squats," not a clinical-sounding reformulation and not a diagnostic label.
- **Never assess severity, cause, or likely diagnosis.** No "this could be patellar tendinitis," no "this is probably nothing," no "this sounds serious" — both false reassurance and false alarm are prohibited, not just one direction.
- **Report the user's own stated intent, not AGym's opinion of what they should do** — "user is considering a professional evaluation" is a fact about the user; it is not the same as AGym recommending one, though the briefing can still *encourage* seeking evaluation when a caution pattern was triggered (see `pain_event.medical_caution_triggered`), phrased as encouragement to seek care, never as a clinical opinion about what's wrong.
- **Always attach the standing disclaimer immediately adjacent to the flag section**, not just once at the top of the document — pain/safety content is exactly the content most likely to get copy-pasted out of context, so the disclaimer needs to travel with it.
- **High visibility, always** — pain/safety flags appear at or near the top of every format, never buried under routine training/nutrition detail, regardless of how the underlying data was sorted.
- **Active specialist restrictions get the same treatment as active pain flags** — surfaced prominently, quoted close to verbatim, with the review date so the reader (agent or human) knows the restriction has a shelf life and isn't being silently treated as permanent doctrine.

## 10. How to Include Plan-vs-Reality / Adherence

- **Always show planned and actual side by side** where a `plan_item_ref` exists — never show only the actual number and call it a day, and never show only the planned number and let the reader assume it happened.
- **Distinguish self-reported adherence from computed adherence explicitly**, per the `adherence_record.provenance` field — "self-reported: ~80%" reads differently than "computed from logs: 71%," and both may legitimately appear together with a note if they diverge, rather than the briefing picking one to trust.
- **Deviations get their reason, when the user gave one** — "swapped cardio for a walk (reason: fatigue)" is more useful to a downstream agent than a bare percentage, because it tells the next planner *why* to adjust, not just *that* something changed.
- **A skipped/modified session is not framed as a failure** — the briefing reports what happened neutrally ("modified: back tightness," "skipped: low motivation") and leaves any judgment about whether that's a problem to the human or agent reading it.
- **When no plan exists for the window**, say so plainly ("No active plan referenced this week — the following sessions are unlinked logs") rather than silently omitting the plan-vs-actual section in a way that could be misread as "adherence was perfect."

## 11. Suggested Final Prompt/Question for the External AI Coach

This is the single highest-leverage sentence in the whole document — it's what turns "here's a report" into "here's a closed loop." It should be **generated per-briefing**, not a static template line, and should:

1. Reference the most decision-relevant fact in the window (an active restriction, a pain flag, a meaningful plan deviation, or — if none of those are present — the most recent training focus).
2. Ask a **specific, actionable** question, not "what do you think?"
3. Never presuppose an answer or nudge toward a particular kind of program.

**Generation heuristic (in priority order):**
1. If a `pain_event` or active specialist restriction exists → ask for program adjustments that respect it explicitly (as in the example above).
2. Else if a plan-vs-actual deviation exists → ask whether to hold, repeat, or progress based on the specific numbers reported.
3. Else if adherence data exists and diverges from plan → ask how to restructure given the actual completion pattern.
4. Else (a clean, on-plan window with no flags) → ask a forward-looking progression question: *"Training has been consistent and on-plan this week — what's the right next step: progress load, add volume, or hold steady another week?"*

**Generic fallback template**, used only if none of the above heuristics produce enough signal (e.g., a very