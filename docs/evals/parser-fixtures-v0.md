# AGym v0 — Parser Fixtures (PF-001 … PF-025)

Status: **authoritative fixture set for Issues 9–10** (`docs/plans/tickets-09-10.md`). Schema shapes per `docs/plans/tickets-03-06.md` Issue 6 (the amended v0 schema). `docs/evals/sample-logs.md` remains background reference; where they differ, this doc wins for the v0 harness.

Payload kinds: `workout | meal | bodyweight | sleep | pain | note`.

## Global invariants (auto-applied to EVERY fixture by the harness)

- `parse()` never throws.
- Every returned event validates against `DraftEventSchema` (incl. non-empty `parserVersion`, non-empty `sourceText`, `uncertaintyFlags` array present).
- Every `sourceText` is a verbatim substring of the raw input.
- **No text silently dropped:** every non-whitespace character of the input (excluding segment separators `;` and newlines) appears in at least one event's `sourceText`.
- `date` equals `defaultDate` unless the fixture says otherwise; `time` is `null` unless the user stated a clock time.
- Exercise names appear **as logged** — no normalization, no canonical names.
- No output field or string contains advice, recommendations, diagnosis, treatment, or risk language.
- Generated `id`s are never asserted.

Per-fixture sections list only the fixture-specific invariants on top of these.

---

## Workout logs

### PF-001 — simple strength workout
Default date: `2026-07-11`
Raw input:
```text
Squat 3x8@80kg; bench 3x5 @ 60kg
```
Tests: workout classification, semicolon segmentation, sets/reps/weight extraction.
Expected invariants:
- ≥1 event; includes ≥1 `workout` event; no `bodyweight` event
- exercises with as-logged names containing `Squat` and `bench`
- extracted sets include reps 8 / weightKg 80 and reps 5 / weightKg 60
- `time: null` on all events
Must not: normalize names; emit uncertainty flags on cleanly stated values.

### PF-002 — multiple exercises + relative date
Default date: `2026-07-11`
Raw input:
```text
yesterday: deadlift 5x3@120kg then ohp 3x8@40kg and some curls to finish
```
Tests: "yesterday" resolution against defaultDate, multi-exercise extraction, unnumbered trailing exercise.
Expected invariants:
- includes a `workout` event with `date: "2026-07-10"`
- deadlift 5x3@120 and ohp 3x8@40 extracted
- "curls" present as an exercise with null reps/weight OR preserved in notes/sourceText
Must not: invent numbers for curls; leave `date` at `2026-07-11` without a flag.

### PF-003 — bodyweight exercises, no load
Default date: `2026-07-11`
Raw input:
```text
pullups 3x10, pushups 4x15
```
Tests: bodyweight-exercise handling; "no weight" ≠ "bodyweight event".
Expected invariants:
- includes ≥1 `workout` event; **no `bodyweight` event**
- reps 10 and 15 extracted; all `weightKg: null`
- may flag missing weight; must not fabricate one
Must not: classify as `bodyweight` kind; assign any weightKg value.

### PF-004 — RPE stated
Default date: `2026-07-11`
Raw input:
```text
squats 5x5 @ 100kg, felt like RPE 8 by the end
```
Tests: RPE extraction, qualitative tail preserved.
Expected invariants:
- `workout` event; squats sets with weightKg 100, reps 5
- at least one set carries `rpe: 8` (or rpe null everywhere WITH a flag referencing rpe — never a wrong number)
Must not: apply RPE 8 confidently to all sets without flagging the ambiguity ("by the end").

### PF-005 — lbs converted to kg
Default date: `2026-07-11`
Raw input:
```text
bench 3x8 @ 185 lbs felt easy
```
Tests: lbs→kg conversion with flag.
Expected invariants:
- `workout` event; bench sets reps 8, weightKg ≈ 83.9 (±0.1)
- uncertainty flag whose `field` targets the converted weight (reason references unit conversion)
Must not: store 185 as kg; convert silently without a flag.

## Meal logs

### PF-006 — user-stated kcal with clock time
Default date: `2026-07-11`
Raw input:
```text
13:00 lunch: chicken rice bowl, about 750 kcal
```
Tests: stated kcal, explicit HH:mm time, "about" hedging.
Expected invariants:
- `meal` event; `kcal: 750`; description mentions chicken rice bowl
- `time: "13:00"`
- uncertainty flag on `payload.kcal` (user said "about")
Must not: adjust or recompute the 750.

### PF-007 — user-stated protein
Default date: `2026-07-11`
Raw input:
```text
post workout shake, 40g protein
```
Tests: proteinG extraction; kcal stays null.
Expected invariants:
- `meal` event; `proteinG: 40`; `kcal: null`
Must not: **compute kcal from protein grams** — nutrition numbers are user-stated only.

### PF-008 — meal with no numbers
Default date: `2026-07-11`
Raw input:
```text
big pasta dinner with mom, definitely overate
```
Tests: numberless meal; no estimation.
Expected invariants:
- `meal` event; `kcal: null`; `proteinG: null`; description preserves the user's words
Must not: estimate calories/macros from the food description; editorialize about overeating.

### PF-009 — messy mixed meal text
Default date: `2026-07-11`
Raw input:
```text
brekkie eggs + toast idk maybe 500cal?? snacked all afternoon
```
Tests: hedged number extraction, slang, trailing vague clause.
Expected invariants:
- ≥1 event; ≥1 `meal` event with `kcal: 500` and an uncertainty flag on `payload.kcal` ("maybe", "??")
- the "snacked all afternoon" text is covered (same meal description, a second meal, or a note — any is acceptable)
Must not: drop the snacking clause; emit kcal 500 unflagged.

## Bodyweight logs

### PF-010 — kg weigh-in
Default date: `2026-07-11`
Raw input:
```text
82.4kg this morning
```
Tests: bodyweight classification from bare weight.
Expected invariants:
- `bodyweight` event; `weightKg: 82.4`
- `time: null` ("morning" is not a clock time)
Must not: convert "morning" into a fabricated HH:mm.

### PF-011 — lbs weigh-in
Default date: `2026-07-11`
Raw input:
```text
weighed in at 181 lbs
```
Tests: lbs→kg on bodyweight.
Expected invariants:
- `bodyweight` event; `weightKg` ≈ 82.1 (±0.1)
- uncertainty flag targeting `payload.weightKg` (unit conversion)
Must not: store 181 as kg.

### PF-012 — ambiguous bare number
Default date: `2026-07-11`
Raw input:
```text
hit 80 today, felt brutal
```
Tests: refusing to guess that a bare number is bodyweight.
Expected invariants:
- ≥1 event; **no `bodyweight` event**
- the number 80 is not assigned to any `weightKg` field anywhere
- classified as `note` (or another kind only if clearly justified), with an uncertainty flag
Must not: fabricate a weigh-in, a load, or a unit.

## Sleep logs

### PF-013 — stated duration
Default date: `2026-07-11`
Raw input:
```text
slept 7.5h
```
Tests: duration extraction.
Expected invariants:
- `sleep` event; `durationH: 7.5`; `quality: null` (nothing qualitative stated)

### PF-014 — qualitative only
Default date: `2026-07-11`
Raw input:
```text
slept great, feel rested
```
Tests: qualitative sleep with no numbers.
Expected invariants:
- `sleep` event; `durationH: null`
- `quality: "good"` (or `null` with an uncertainty flag — never a wrong value)
Must not: invent a duration or a numeric sleep score.

### PF-015 — vague negative sleep
Default date: `2026-07-11`
Raw input:
```text
slept like crap again
```
Tests: idiom, negative quality, nothing quantifiable.
Expected invariants:
- `sleep` event; `durationH: null`
- `quality: "poor"` (or `null` with flag)
Must not: invent duration, invent a 1–10 score, or treat "crap" as anything other than sleep-quality language.

## Pain logs

### PF-016 — explicit body part
Default date: `2026-07-11`
Raw input:
```text
right knee hurt during squats today
```
Tests: pain classification (not note), body part capture.
Expected invariants:
- ≥1 `pain` event; `bodyPart` contains "knee"; `severity: null`
- description preserves the user's own words
Must not: emit a diagnosis (e.g. "possible tendinitis"), a cause inference, a risk statement, or treatment advice — in any field or string.

### PF-017 — severity stated
Default date: `2026-07-11`
Raw input:
```text
shoulder pain, about a 6/10
```
Tests: user-stated severity extraction.
Expected invariants:
- `pain` event; `bodyPart` contains "shoulder"; `severity: 6`
- flag on severity acceptable ("about"); value must still be 6, not rounded elsewhere
Must not: recommend rest/ice/medication; interpret 6/10 clinically.

### PF-018 — no severity stated
Default date: `2026-07-11`
Raw input:
```text
lower back really sore after deadlifts
```
Tests: severity stays null despite intensity words.
Expected invariants:
- `pain` event; `bodyPart` contains "back"; `severity: null`
Must not: map "really sore" to a number — severity is user-stated only, NEVER inferred.

### PF-019 — injury/discomfort language
Default date: `2026-07-11`
Raw input:
```text
think i tweaked my hamstring, weird pulling feeling when sprinting
```
Tests: colloquial injury language routes to `pain`, not `note`.
Expected invariants:
- ≥1 `pain` event; `bodyPart` contains "hamstring"; `severity: null`
- description stays verbatim-adjacent ("tweaked", "pulling feeling" preserved)
Must not: name a condition (strain/tear/grade), suggest treatment, or assess risk.

## Mixed multi-event logs

### PF-020 — workout + pain
Default date: `2026-07-11`
Raw input:
```text
squat 5x5@90kg; knee started aching on set 3
```
Tests: one log → two events of different kinds.
Expected invariants:
- ≥2 events; ≥1 `workout` (squat 5x5@90) and ≥1 `pain` (`bodyPart` contains "knee", `severity: null`)
- each event's `sourceText` is its own segment
Must not: merge the pain into workout notes and drop the `pain` event; advise deloading.

### PF-021 — bodyweight + meal
Default date: `2026-07-11`
Raw input:
```text
84.0kg fasted
oats and banana for breakfast
```
Tests: newline segmentation, two independent kinds.
Expected invariants:
- ≥2 events; `bodyweight` with `weightKg: 84` and `meal` with description containing "oats"
- meal `kcal: null`, `proteinG: null`
Must not: compute breakfast calories; attach "fasted" to the meal instead of the weigh-in context.

### PF-022 — sleep + note + workout
Default date: `2026-07-11`
Raw input:
```text
slept 6h
felt off all day
evening: squats 3x5@85kg
```
Tests: three segments, three kinds, non-clock time word.
Expected invariants:
- ≥3 events: `sleep` (`durationH: 6`), `note` ("felt off all day" preserved), `workout` (squats 3x5@85)
- `time: null` on all events ("evening" is not HH:mm)
Must not: turn "felt off" into a mood score or a recovery metric; drop the middle line.

## Garbage / ambiguous logs

### PF-023 — pure garbage
Default date: `2026-07-11`
Raw input:
```text
asdf qwerty 123 zzz
```
Tests: unparseable input safety net.
Expected invariants:
- exactly ≥1 event, all of kind `note`, with an uncertainty flag
- input text preserved verbatim (note text and/or sourceText)
- the number 123 is not assigned to any structured field
Must not: throw; return zero events; invent any workout/meal/weight structure.

### PF-024 — emoji + fragment
Default date: `2026-07-11`
Raw input:
```text
💀💀💀 leg day
```
Tests: non-ASCII survival, fragment with a fitness word but no data.
Expected invariants:
- ≥1 event; `note` OR `workout` acceptable, with an uncertainty flag
- if `workout`: zero fabricated exercises/sets/weights (empty or null-valued only)
- emoji preserved in sourceText
Must not: invent exercises, sets, loads, or duration from "leg day".

### PF-025 — non-fitness text
Default date: `2026-07-11`
Raw input:
```text
remember to email marco about the invoice
```
Tests: out-of-domain text is kept, not forced into fitness shapes.
Expected invariants:
- exactly ≥1 event of kind `note`; text preserved verbatim
Must not: classify as any fitness kind; extract "invoice" content into structured fields; discard as irrelevant.

---

## Fixture harness guidance

- **Prefer invariant assertions over exact JSON snapshots.** The mock parser and any future parser may differ in harmless details (segment boundaries, flag wording, note granularity); deep-equal golden files would break on every such difference without catching real regressions.
- Suggested representation: this Markdown doc is the human-readable source; the harness consumes per-fixture assertion specs (`.ts` objects or `.json`) derived from it — one spec per PF id, auto-discovered.
- Assertions should check: event kinds, required DraftEvent fields, selected extracted values, uncertainty flags (presence + target field), and sourceText coverage.
- **Do not assert generated IDs.**
- **Do not assert exact event ordering** unless segmentation makes order obvious (e.g. PF-022's three lines).
- **Do not assert exact wording of uncertainty reasons** — assert the flag exists and targets the right field; wording matters only where the reason *category* matters (e.g. unit conversion).
- **Always assert no text was silently dropped** (the global coverage invariant): every non-whitespace input character (excluding `;`/newline separators) appears in some event's `sourceText`, and every `sourceText` is a verbatim substring of the input.
- Numeric tolerance: unit conversions assert ±0.1 kg; user-stated numbers assert exact equality.
