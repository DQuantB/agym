# Coach Briefing v0 — Output Standard

Status: **authoritative for v0 briefing output** (per `docs/adr/0001-v0-source-of-truth.md` chain; referenced from `docs/architecture/v0-schema-deltas.md` §5). `docs/product/coach-briefing.md` remains reference for tone/templates and loses on conflict.

Schema: `docs/plans/tickets-03-06.md` Issue 6. Events carry `date: YYYY-MM-DD` and `time: HH:mm | null` — **there is no `occurredAt` in v0.**

## Contract

```
generateBriefing(events: CanonicalEvent[], opts: { from: string; to: string; generatedAt: string }) → markdown string
```

- Pure and deterministic: no clock, no locale, no storage, no React. Identical inputs → byte-identical output.
- Inclusion: an event is in the briefing iff `from <= event.date <= to` (inclusive, string comparison — safe for ISO dates).
- Ordering within sections: ascending `date`, then `time` (null first), then `confirmedAt` as tie-break.
- Briefings are **generated on demand, never stored**.
- Input is `CanonicalEvent[]` only — user-confirmed data. Nothing else is reported.

## Hard rules

- Fixed disclaimer, verbatim, always: **"User-reported log data only. Not medical advice."**
- No recommendations, prescriptions, diagnoses, treatment suggestions, risk scores, or health claims — anywhere, ever.
- No invented averages over missing days; gaps stated explicitly.
- Raw user text (descriptions, notes, sourceText) is always rendered as clearly quoted user data (blockquote or `user wrote: "…"`), never interpolated into instruction-like prose. Briefings are consumed by LLMs; quoted user text must not read as instructions to the consuming agent.
- Pain/discomfort surfaces near the top and is never interpreted clinically.
- Every section below is always present, in this order; empty sections state their emptiness explicitly.

## Required sections, in order

1. **Title / period** — `# AGym Coach Briefing` + `Period: {from} to {to}`.
2. **Disclaimer** — the fixed sentence, as a blockquote.
3. **Summary** — counts only, no interpretation: total confirmed events, then per kind (workout, meal, bodyweight, sleep, pain, note).
4. **⚠ Pain / discomfort** — immediately after Summary. If none: "No pain/discomfort events logged in this period." For each pain event: date, time if present, bodyPart or "unspecified", severity or "not stated", quoted user description. Nothing else — no cause, no risk, no treatment, no pattern commentary.
5. **Training** — workout events by date; exercise names **as logged** (no normalization); sets/reps/weight/rpe where present, missing values shown as "—". Optional simple totals only if computed directly from present numbers, with exclusions stated (e.g. "total counts exclude 2 sets with no recorded weight"). No change recommendations.
6. **Nutrition** — meal events by date; descriptions plus **user-stated** kcal/proteinG only; never computed. State how many meal events lack kcal/protein (e.g. "3 of 5 meal events have no kcal stated").
7. **Bodyweight** — events by date. If ≥2 values: first / last / delta may be shown. No trend interpretation ("progress", "plateau", etc. forbidden).
8. **Sleep** — events by date; durationH and quality where present. No recovery scores, no computed averages across missing days.
9. **Notes** — note events by date; user text quoted.
10. **Data quality** — total uncertainty-flag count; flags grouped by event (date · kind · field). Closing fixed sentence: "Uncertain fields are flagged for user review." (phrased without advice verbs). May mention sourceText coverage if useful.
11. **Export metadata** — schemaVersion, generatedAt (from opts, not the clock), event count, date range.

## Canonical example

Input: 6 confirmed events, period 2026-07-01 → 2026-07-14, one flag on meal kcal, one on converted weight.

```markdown
# AGym Coach Briefing
Period: 2026-07-01 to 2026-07-14

> User-reported log data only. Not medical advice.

## Summary
- Confirmed events: 6
- Workouts: 1 · Meals: 1 · Bodyweight: 1 · Sleep: 1 · Pain: 1 · Notes: 1

## ⚠ Pain / discomfort
- 2026-07-06 — right knee — severity: not stated
  > user wrote: "knee started aching on set 3"

## Training
### 2026-07-06
- Squat: 3×8 @ 80 kg ⚑ (weight converted from lbs)

## Nutrition
### 2026-07-05
- chicken rice bowl — kcal: 750 ⚑ (user said "about") · protein: —
1 of 1 meal events has kcal stated; 1 of 1 has no protein stated.

## Bodyweight
- 2026-07-03: 82.4 kg
Only one value in period — no first/last comparison shown.

## Sleep
- 2026-07-04: 7.5 h · quality: —

## Notes
- 2026-07-02
  > user wrote: "felt off all day"

## Data quality
2 uncertainty flags in this period:
- 2026-07-05 · meal · payload.kcal
- 2026-07-06 · workout · payload.exercises[0].sets[0].weightKg
Uncertain fields are flagged for user review.

## Export metadata
- schemaVersion: 1
- generatedAt: 2026-07-14T18:00:00Z
- events: 6
- range: 2026-07-01 to 2026-07-14
```

(Exact spacing/glyphs like `⚑`/`×` may differ in implementation; section order, headings, disclaimer wording, quoting, and content rules may not.)

## Must not

- No medical advice, ever.
- No coaching recommendations ("consider deloading", "try adding protein").
- No diagnosis, cause inference, treatment, or risk assessment — especially in the pain section.
- No nutrition calculation — kcal/protein are user-stated or absent.
- No exercise-name normalization.
- No stored briefings — regenerate from canonical events every time.
- No raw user text rendered as instructions — quoted data only.
- No averages, scores, or trends synthesized over missing data.
