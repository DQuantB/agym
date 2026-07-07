# AGym — v0 Data Model / Object Schemas
**Intended path:** `docs/architecture/schemas.md` (or `docs/architecture/data-model.md`)
**Target stack:** TypeScript types + Postgres/Supabase, v0
**Status:** Draft v0 — foundation for MVP build

---

## 0. Shared Conventions (read this before the per-object sections)

These conventions apply across every object below. Defining them once keeps the 18 schemas consistent and keeps the Postgres/Supabase implementation boring in the best way.

### 0.1 IDs and timestamps
- All primary keys: `id uuid default gen_random_uuid()`.
- All timestamps: `timestamptz`, stored UTC, ISO 8601 in JSON (`2026-07-06T09:15:00Z`).
- Every mutable table has `created_at` and `updated_at`. Anything user-deletable has `deleted_at timestamptz null` (soft delete) — hard delete is a background job triggered by user request, not the default write path, so accidental foreign-key breakage can't happen mid-request.

### 0.2 `provenance_type` — the single most important enum in this system
Per the design rules, **uncertainty must never flatten into truth**. Every fact-bearing object carries a `provenance` field from this fixed enum:

```typescript
type ProvenanceType =
  | "raw_self_report"        // verbatim from the user, unprocessed
  | "llm_parsed_uncertain"   // machine-parsed, not yet reviewed by the user
  | "user_confirmed"         // user has reviewed/edited and confirmed it
  | "agent_written_plan"     // a plan authored by an AI agent (ChatGPT/Claude/etc.)
  | "human_specialist_plan"  // a plan authored by a human professional (physio/dietitian/coach)
  | "imported_device"        // pulled from a wearable/sensor (post-v0, schema-ready now)
  | "specialist_verified"    // a human professional has reviewed/signed off on this record
  | "derived_metric"         // computed by AGym from other canonical data (e.g. adherence %)
  | "ai_hypothesis";         // a speculative AI inference — must NEVER be presented as fact,
                             // must never appear in canonical_event without this tag, and in
                             // v0 should basically never be written at all (see 0.5)
```

Nothing in this system may silently upgrade its own provenance. A `llm_parsed_uncertain` row becomes `user_confirmed` only via an explicit user action that creates a *new* record (see `parsed_event` → `canonical_event`); it is never mutated in place to look more certain than it was.

### 0.3 `confidence_level` — field-level, not just record-level
```typescript
type ConfidenceLevel = "high" | "medium" | "low" | "unknown";
```
Confidence is attached **per field**, inside a `confidence` jsonb map keyed by field name, not as one blanket score for the whole record. This mirrors the eval set (`docs/evals` / `evals/agym_v0_samples.json`) where e.g. `exercise: high, load_kg: medium` can coexist in the same event.

### 0.4 Units
```typescript
type MassUnit = "kg" | "lb";
type EventType =
  | "workout" | "cardio" | "nutrition" | "sleep" | "mood"
  | "body_metric" | "pain_flag" | "period_summary" | "unknown";
```

### 0.5 On `ai_hypothesis`
This provenance value exists so the schema *can* represent a future speculative-AI-inference feature (e.g. "this pattern might suggest X") without ever confusing it with logged fact. **In v0, do not build any feature that writes `ai_hypothesis` records.** It's included now so that if/when such a feature ships, it slots into the existing provenance model instead of requiring a schema migration and a re-audit of every "is this fact or guess" call site. Ship the enum value; don't ship the feature.

### 0.6 Postgres/Supabase pragmatics
- Use native Postgres `enum` types for the fixed vocabularies above (`provenance_type`, `confidence_level`, `event_type`) — cheap to validate, cheap to query, cheap to extend with `ALTER TYPE ... ADD VALUE`.
- Use `jsonb` for `fields`, `confidence`, `parsed_plan`, `flags`, and other semi-structured content. Don't normalize these into columns in v0 — the shape of a "parsed event" will change weekly during validation, and jsonb absorbs that without migrations.
- Do normalize `exercise_set` and `food_item` as real child tables (see below) — these are the rows you'll actually query/aggregate over (progression tracking, macro-adjacent views later), so they earn real columns from day one.
- Row Level Security (RLS) in Supabase should scope every table by `user_id = auth.uid()` from the start — this is a five-minute policy to write now and a painful retrofit later.

---

## 1. `user_profile`

### Purpose
Minimal account identity and scoping anchor. This is **not** a health profile — it holds only what's needed to run the app, not clinical/demographic detail that isn't yet justified by a feature.

### Required fields
`id`, `auth_id` (Supabase auth user id), `created_at`, `unit_preference`, `timezone`.

### Optional fields
`display_name`, `date_of_birth`, `sex`, `height_cm`.

### Field types
```typescript
interface UserProfile {
  id: string;               // uuid
  auth_id: string;          // uuid, FK to auth.users
  created_at: string;       // iso8601
  updated_at: string;
  display_name?: string;
  unit_preference: MassUnit;
  timezone: string;         // IANA tz, e.g. "Europe/Berlin"
  date_of_birth?: string;   // date
  sex?: "male" | "female" | "other" | "prefer_not_to_say";
  height_cm?: number;
  deleted_at?: string | null;
}
```

### Example JSON
```json
{
  "id": "5f2c...",
  "auth_id": "a1b2...",
  "created_at": "2026-06-01T08:00:00Z",
  "updated_at": "2026-06-01T08:00:00Z",
  "unit_preference": "kg",
  "timezone": "Europe/Berlin",
  "display_name": "J."
}
```

### Validation rules
- `unit_preference` required, no default guess — ask once at onboarding rather than inferring (this directly prevents eval_10/eval_13-style unit ambiguity downstream).
- `date_of_birth`, `sex`, `height_cm` are opt-in and must not be required to use the logger or briefing generator at all.

### Privacy/consent considerations
`date_of_birth`, `sex`, `height_cm` are the only fields here that count as sensitive demographic health data — gate them behind an explicit "why we're asking" microcopy and keep them fully optional. Full export/delete applies to this whole object.

### MVP or later
**MVP** (minimal version — id, auth_id, unit_preference, timezone only; the optional demographic fields can ship in v0 too since they're opt-in, but nothing downstream should depend on them being present).

---

## 2. `raw_log`

### Purpose
The verbatim, unstructured capture from Stage 3 of the loop. This is the most important table in the system for trust: it must never be silently altered by parsing.

### Required fields
`id`, `user_id`, `created_at`, `logged_for_date`, `raw_text`.

### Optional fields
`source_hint`, `plan_ref`, `client_meta`.

### Field types
```typescript
interface RawLog {
  id: string;
  user_id: string;
  created_at: string;
  logged_for_date: string;       // date; defaults to created_at's date, user-overridable
  raw_text: string;
  source_hint?: "workout" | "meal" | "sleep" | "mood" | "other"; // optional, user-supplied, never required
  plan_ref?: string | null;      // uuid FK to plan.id, if user tagged it
  client_meta?: { app_version?: string };  // NOT device fingerprint / location
  deleted_at?: string | null;
}
```

### Example JSON
```json
{
  "id": "9a11...",
  "user_id": "5f2c...",
  "created_at": "2026-07-06T18:22:11Z",
  "logged_for_date": "2026-07-06",
  "raw_text": "squats today 5x5 @100kg felt smooth, then bench 3x8 @70 last set was rough tbh"
}
```

### Validation rules
- `raw_text` must be non-empty (v0 is text-only; attachments are a later type, not a null-text workaround).
- `raw_text` is immutable after creation — corrections happen downstream (`canonical_event.correction_diff`), never by editing `raw_log` in place. This is a hard rule, not a convention: the original must remain reconstructable indefinitely.

### Privacy/consent considerations
Highest sensitivity tier in the system — free text about body/health/sometimes mental state. Encrypt at rest. Must be individually deletable (per-row soft delete → hard delete within stated SLA) and included in full account export.

### MVP or later
**MVP.** This table is the product.

---

## 3. `parsed_event`

### Purpose
The LLM's structured best-effort read of a `raw_log`, before the user has seen or confirmed it (Stage 4 output). Exists so a wrong parse is a visible, correctable, non-authoritative artifact — never conflated with canonical fact.

### Required fields
`id`, `raw_log_id`, `event_type`, `fields`, `confidence`, `parse_status`, `provenance`, `created_at`.

### Optional fields
`plan_ref_guess`, `parser_version`.

### Field types
```typescript
interface ParsedEvent {
  id: string;
  raw_log_id: string;
  event_type: EventType;
  fields: Record<string, unknown>;              // jsonb, shape varies by event_type
  confidence: Record<string, ConfidenceLevel>;   // jsonb, keyed to fields' keys
  parse_status: "parsed" | "partial" | "failed";
  provenance: "llm_parsed_uncertain";            // fixed value for this table
  plan_ref_guess?: string | null;                // best-effort match, not authoritative
  parser_version?: string;                       // e.g. "parser-v0.3" for later A/B and regression tracking
  created_at: string;
}
```

### Example JSON
```json
{
  "id": "c701...",
  "raw_log_id": "9a11...",
  "event_type": "workout",
  "fields": {
    "exercises": [
      { "exercise": "back squat", "sets": 5, "reps": 5, "load_kg": 100 },
      { "exercise": "bench press", "sets": 3, "reps": 8, "load_kg": 70 }
    ]
  },
  "confidence": {
    "exercises.0.load_kg": "high",
    "exercises.1.load_kg": "medium"
  },
  "parse_status": "parsed",
  "provenance": "llm_parsed_uncertain",
  "parser_version": "parser-v0.1",
  "created_at": "2026-07-06T18:22:14Z"
}
```

### Validation rules
- `provenance` is always `"llm_parsed_uncertain"` here — enforced at the DB/type level, not just convention, so a bug can never write a `parsed_event` row that claims to be confirmed.
- Every leaf field the parser fills in `fields` should have a corresponding key in `confidence`. Missing confidence for a populated field should fail a lint check in the parser pipeline (not a DB constraint — jsonb depth makes a real FK/constraint impractical, but this should be asserted in application code and covered by the eval set).
- `parse_status: "failed"` rows may have an empty or minimal `fields` object — that's expected, not an error state (see eval_15).

### Privacy/consent considerations
Same sensitivity tier as `raw_log` since `fields` may contain structured health data (e.g. pain locations). Must cascade-delete alongside its parent `raw_log`. If parsing runs through a third-party LLM API, this table's *existence* is the direct evidence of that processing — cover it explicitly in the `consent_record` for `llm_parsing`.

### MVP or later
**MVP.**

---

## 4. `canonical_event`

### Purpose
The permanent record after Stage 5 (user correction/confirmation) — the actual asset of the product. Acts as a lightweight polymorphic parent; per-type detail lives in the typed tables below (`workout_session`, `meal_event`, etc.), each of which has a `canonical_event_id` FK back here. This keeps one place to query "everything that happened on date X regardless of type" while letting typed tables have real, queryable columns.

### Required fields
`id`, `user_id`, `event_type`, `date`, `provenance`, `confirmed_at`, `source_raw_log_id`.

### Optional fields
`source_parsed_event_id`, `plan_ref`, `correction_diff`, `final_fields` (used only for event types that don't yet have a dedicated typed table — see `mood`/`period_summary`).

### Field types
```typescript
interface CanonicalEvent {
  id: string;
  user_id: string;
  event_type: EventType;
  date: string;
  provenance: Extract<ProvenanceType,
    "user_confirmed" | "specialist_verified" | "imported_device" | "derived_metric">;
  source_raw_log_id: string;
  source_parsed_event_id?: string | null;
  plan_ref?: string | null;
  final_fields?: Record<string, unknown>;   // only for untyped/catch-all event types
  correction_diff?: Record<string, [unknown, unknown]> | null; // internal only, never shown raw to the user
  confirmed_at: string;
  updated_at: string;
  deleted_at?: string | null;
}
```

### Example JSON
```json
{
  "id": "d802...",
  "user_id": "5f2c...",
  "event_type": "workout",
  "date": "2026-07-06",
  "provenance": "user_confirmed",
  "source_raw_log_id": "9a11...",
  "source_parsed_event_id": "c701...",
  "confirmed_at": "2026-07-06T18:24:02Z",
  "updated_at": "2026-07-06T18:24:02Z"
}
```
(The workout detail itself lives in `workout_session` + `exercise_set` rows referencing this `id`.)

### Validation rules
- `provenance` **cannot** be `"raw_self_report"`, `"llm_parsed_uncertain"`, `"agent_written_plan"`, `"human_specialist_plan"`, or `"ai_hypothesis"` — enforce via a Postgres `CHECK` constraint or a narrower DB enum, because this table's entire purpose is "things that have passed the confirmation gate."
- Every `canonical_event` must trace back to a `source_raw_log_id`, except `derived_metric` rows (e.g. computed adherence), which instead reference the set of `canonical_event.id`s they were computed from in `final_fields.computed_from`.
- `correction_diff`, if present, is never rendered verbatim in the Coach Briefing or shown to the user as a "gotcha" — it's for internal parser-quality analytics only (see eval_13).

### Privacy/consent considerations
The core user-owned data asset described in the product thesis. Must support full export (all rows for a user, joined with typed detail tables, as one JSON document) and full delete on request, with a stated SLA.

### MVP or later
**MVP.**

---

## 5. `workout_session`

### Purpose
Typed detail parent for a `canonical_event` of type `"workout"` — session-level metadata; individual sets live in `exercise_set`.

### Required fields
`id`, `canonical_event_id`, `date`.

### Optional fields
`session_label`, `plan_item_ref`, `note`.

### Field types
```typescript
interface WorkoutSession {
  id: string;
  canonical_event_id: string;   // FK, event_type must be "workout"
  date: string;
  session_label?: string;       // e.g. "upper push", "leg day (planned)"
  plan_item_ref?: string | null; // FK to plan_item, for plan-vs-actual comparison
  note?: string;                // free text, e.g. "felt smooth", qualitative color
  status?: "completed" | "skipped" | "partial";
}
```

### Example JSON
```json
{
  "id": "e903...",
  "canonical_event_id": "d802...",
  "date": "2026-07-06",
  "session_label": "upper push",
  "status": "completed"
}
```

### Validation rules
- `status: "skipped"` sessions may have zero `exercise_set` children — a skip is itself the data point (eval_03) and must not be treated as a missing/invalid record.
- If `plan_item_ref` is set, the referenced `plan_item` should be of `item_type: "exercise"` or a day-level grouping — enforce in application code, not DB constraint (plan_item's shape varies too much for a tight FK type check).

### Privacy/consent considerations
No special sensitivity beyond the general canonical-memory tier.

### MVP or later
**MVP.**

---

## 6. `exercise_set`

### Purpose
Normalized, queryable set-level rows — the actual unit you'd aggregate over for progression tracking, volume totals, etc. This is the one place in the schema where real columns (not jsonb) are worth the modeling effort from day one.

### Required fields
`id`, `workout_session_id`, `exercise_name`, `set_number`.

### Optional fields
`reps`, `load`, `unit`, `rpe`, `planned_reps`, `planned_load`, `note`.

### Field types
```typescript
interface ExerciseSet {
  id: string;
  workout_session_id: string;
  exercise_name: string;
  set_number: number;           // 1-indexed within the exercise
  reps?: number | "AMRAP";
  load?: number;
  unit?: MassUnit | "bodyweight" | "band";
  rpe?: number;                 // 1-10, self-reported
  planned_reps?: number | "AMRAP";
  planned_load?: number;
  note?: string;
}
```

### Example JSON
```json
{
  "id": "f004...",
  "workout_session_id": "e903...",
  "exercise_name": "back squat",
  "set_number": 1,
  "reps": 5,
  "load": 100,
  "unit": "kg"
}
```

### Validation rules
- `set_number > 0`.
- If `load` is present, `unit` must be present too — this directly encodes the eval_01/eval_13 lesson that an un-unitized number is a parser bug waiting to happen, not a valid confirmed record. `parsed_event.fields` can be unit-less pre-confirmation; `exercise_set` (post-confirmation) cannot.
- `reps` accepts the literal string `"AMRAP"` in addition to a number.

### Privacy/consent considerations
None beyond general tier.

### MVP or later
**MVP.**

---

## 7. `meal_event`

### Purpose
Typed detail parent for a `canonical_event` of type `"nutrition"` — meal-level metadata; individual items live in `food_item`.

### Required fields
`id`, `canonical_event_id`, `date`, `meal_type`.

### Optional fields
`note`.

### Field types
```typescript
interface MealEvent {
  id: string;
  canonical_event_id: string;    // event_type must be "nutrition"
  date: string;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack" | "unspecified";
  note?: string;
}
```

### Example JSON
```json
{
  "id": "10a1...",
  "canonical_event_id": "d900...",
  "date": "2026-07-06",
  "meal_type": "lunch"
}
```

### Validation rules
`meal_type` defaults to `"unspecified"` rather than being guessed from time-of-day if the user didn't say — guessing "lunch" from a 2pm timestamp when the user just said "food" is exactly the kind of fabricated precision the eval set warns against (eval_08).

### Privacy/consent considerations
None beyond general tier. **v0 explicitly does not compute or store calorie/macro totals** — see `food_item` below.

### MVP or later
**MVP.**

---

## 8. `food_item`

### Purpose
Individual food line items under a `meal_event`. Deliberately shallow — no nutrition database lookups, no calorie math, in v0.

### Required fields
`id`, `meal_event_id`, `item_name`.

### Optional fields
`quantity`, `quantity_range`, `unit`, `confidence`, `note`.

### Field types
```typescript
interface FoodItem {
  id: string;
  meal_event_id: string;
  item_name: string;
  quantity?: number | null;
  quantity_range?: string | null;   // e.g. "1-2", used when the user gave a range not a number
  unit?: string | null;             // freeform: "slice", "tbsp", "cup", "count" — not a fixed enum in v0
  confidence?: ConfidenceLevel;
  note?: string;                    // e.g. "restaurant-prepared, oil amount unknown"
}
```

### Example JSON
```json
{
  "id": "11b2...",
  "meal_event_id": "10a1...",
  "item_name": "rice",
  "quantity": null,
  "quantity_range": "1-2",
  "unit": "cup",
  "confidence": "low"
}
```

### Validation rules
- `quantity` and `quantity_range` are mutually exclusive but both nullable — a `food_item` with neither is valid (e.g. "some sauce," eval_08) and must not be forced into a fake number.
- No `calories`, `macros`, or `nutrition_estimate` fields exist in this schema by design. Adding them is a deliberate, later, explicitly-scoped decision — not something that should sneak in as a "helpful" column.

### Privacy/consent considerations
None beyond general tier.

### MVP or later
**MVP.**

---

## 9. `running_event`

### Purpose
Typed detail table for a `canonical_event` of type `"cardio"` (running v0; other cardio modalities can reuse this table with an `activity_type` value rather than needing a new table).

### Required fields
`id`, `canonical_event_id`, `date`, `activity_type`.

### Optional fields
`distance_km`, `duration_seconds`, `perceived_effort`, `measurement_quality`, `note`.

### Field types
```typescript
interface RunningEvent {
  id: string;
  canonical_event_id: string;     // event_type must be "cardio"
  date: string;
  activity_type: "run" | "walk" | "bike" | "swim" | "other_cardio";
  distance_km?: number;
  duration_seconds?: number;
  perceived_effort?: "easy" | "moderate" | "hard" | "max" | null;
  measurement_quality?: "full" | "partial" | "estimated";
  note?: string;
}
```

### Example JSON
```json
{
  "id": "12c3...",
  "canonical_event_id": "d905...",
  "date": "2026-07-06",
  "activity_type": "run",
  "distance_km": 5,
  "duration_seconds": 1650,
  "perceived_effort": "easy",
  "measurement_quality": "partial",
  "note": "watch died at 4.2km, remainder distance/time estimated"
}
```

### Validation rules
`measurement_quality: "partial"` or `"estimated"` must carry a `note` explaining why — a partial measurement with no explanation is a parser bug (dropping the caveat, per eval_06), not a valid minimal record.

### Privacy/consent considerations
None beyond general tier.

### MVP or later
**MVP.**

---

## 10. `recovery_metric`

### Purpose
Typed detail table for `canonical_event` of type `"sleep"` or `"mood"` — deliberately combined into one loose table in v0 rather than building out a full recovery-metrics taxonomy (HRV, soreness scales, readiness scores) before it's justified.

### Required fields
`id`, `canonical_event_id`, `date`, `metric_type`.

### Optional fields
`duration_hours`, `duration_is_estimate`, `quality_note`, `self_rated_scale`.

### Field types
```typescript
interface RecoveryMetric {
  id: string;
  canonical_event_id: string;   // event_type must be "sleep" or "mood"
  date: string;
  metric_type: "sleep" | "mood" | "soreness" | "general_recovery_note";
  duration_hours?: number;
  duration_is_estimate?: boolean;
  quality_note?: string;
  self_rated_scale?: number | null;   // 1-10, only if user gave one — never inferred
}
```

### Example JSON
```json
{
  "id": "13d4...",
  "canonical_event_id": "d906...",
  "date": "2026-07-06",
  "metric_type": "sleep",
  "duration_hours": 5,
  "duration_is_estimate": true,
  "quality_note": "poor, woke twice, feels wrecked"
}
```

### Validation rules
`self_rated_scale` must be null unless the user actually stated a number/scale — AGym never invents a numeric "sleep quality score" from qualitative text (eval_09). This is a hard rule, not a nice-to-have.

### Privacy/consent considerations
Sleep/mood data can correlate with mental health patterns over time. v0 stores it as plain fact only — no derived wellbeing scoring, no trend-based inference, no `ai_hypothesis` rows generated from this table in v0.

### MVP or later
**MVP** (sleep + free-text mood only; soreness scales, HRV, and other quantified recovery metrics are later, once a device-import path exists).

---

## 11. `body_metric`

### Purpose
Typed detail table for `canonical_event` of type `"body_metric"` — weight and (later) other body measurements.

### Required fields
`id`, `canonical_event_id`, `date`, `metric_type`, `value`, `unit`.

### Optional fields
`conditions`, `note`, `prior_value_claimed`.

### Field types
```typescript
interface BodyMetric {
  id: string;
  canonical_event_id: string;
  date: string;
  metric_type: "body_weight" | "waist_cm" | "other";
  value: number;
  unit: MassUnit | "cm";
  conditions?: string;              // e.g. "fasted, AM"
  prior_value_claimed?: number | null;  // user's own recall of a past value, for cross-check display only
  note?: string;
}
```

### Example JSON
```json
{
  "id": "14e5...",
  "canonical_event_id": "d907...",
  "date": "2026-07-06",
  "metric_type": "body_weight",
  "value": 82.4,
  "unit": "kg",
  "conditions": "fasted, AM",
  "prior_value_claimed": 83.1
}
```

### Validation rules
`unit` is required at this (post-confirmation) layer even if it wasn't stated in the raw log — the confirmation step (Stage 5) must force resolution of unit ambiguity before a `body_metric` row is written, since a wrong unit here silently corrupts a trend line permanently.

### Privacy/consent considerations
Sensitive health data. Must be covered explicitly in consent screens, included in full export/delete. No BMI, body-fat inference, or health-risk commentary auto-generated from this table — that would be an `ai_hypothesis`-shaped feature and is explicitly out of scope for v0.

### MVP or later
**MVP** (body weight only; waist/other circumference measurements are a trivial later extension of the same table, not a new object).

---

## 12. `pain_event`

### Purpose
Typed detail table for `canonical_event` of type `"pain_flag"` — the highest-sensitivity, highest-visibility record type in the system. By design, this schema contains **no diagnosis field at all**; there is nowhere in this table for AGym to record a medical opinion, because it must never form one.

### Required fields
`id`, `canonical_event_id`, `date`, `body_part`, `symptom_description`.

### Optional fields
`trigger_activity`, `sessions_affected_count`, `user_stated_intent`, `resolved_at`, `medical_caution_triggered`.

### Field types
```typescript
interface PainEvent {
  id: string;
  canonical_event_id: string;
  date: string;
  body_part: string;
  symptom_description: string;        // verbatim-adjacent, minimally reworded from user's own words
  trigger_activity?: string;
  sessions_affected_count?: number;
  user_stated_intent?: string;        // e.g. "considering professional evaluation" — user's own words, not AGym's assessment
  resolved_at?: string | null;
  medical_caution_triggered?: boolean; // true when the log matched a pattern requiring the standard
                                        // "talk to a professional" redirect (see eval_20)
  high_visibility_flag: boolean;       // defaults to true, always
}
```

### Example JSON
```json
{
  "id": "15f6...",
  "canonical_event_id": "d908...",
  "date": "2026-07-06",
  "body_part": "right knee",
  "symptom_description": "sharp pain radiating toward shin during squats",
  "trigger_activity": "squatting",
  "sessions_affected_count": 2,
  "user_stated_intent": "considering professional evaluation",
  "high_visibility_flag": true,
  "medical_caution_triggered": false
}
```

### Validation rules
- No `diagnosis`, `severity_score`, or `assessed_risk` field exists anywhere in this table, and none should be added without a full product/safety review — this is the schema-level enforcement of "no medical claims."
- `high_visibility_flag` defaults to `true` and cannot be set `false` by the parser — only a user action can suppress a pain event's visibility, and even then it should stay in canonical memory, just deprioritized in the briefing view.
- `medical_caution_triggered = true` rows must always be accompanied by application-layer logic that redirects the user to professional consultation at the moment of logging (Stage 5), not just at Coach Briefing generation time (Stage 7) — the redirect can't wait a week.

### Privacy/consent considerations
The most sensitive object in the schema. Store with the same or higher encryption/access-control bar as any other field. Never used as input to any recommendation, benchmarking, or model-training pipeline without its own separate, explicit consent scope — bundling it into general `llm_parsing` consent is not sufficient.

### MVP or later
**MVP** — pain/injury flags are core to trust and were explicitly required in the eval set (eval_11, eval_20); this is not a "later" feature even though it's sensitive.

---

## 13. `plan`

### Purpose
Stage 1 intake object. Holds both the raw plan text and a best-effort parse, and — critically — the `provenance` distinguishing an AI agent's casual suggestion from a specialist's clinical instruction, since these deserve very different handling downstream.

### Required fields
`id`, `user_id`, `created_at`, `raw_plan_text`, `provenance`.

### Optional fields
`label`, `source_name`, `parsed_plan`, `high_visibility_flag`, `review_date`.

### Field types
```typescript
interface Plan {
  id: string;
  user_id: string;
  created_at: string;
  raw_plan_text: string;
  provenance: Extract<ProvenanceType, "agent_written_plan" | "human_specialist_plan" | "raw_self_report">;
  label?: string;
  source_name?: string;             // freeform, e.g. "ChatGPT", "Dr. Smith", "self"
  parsed_plan?: Record<string, unknown>;  // jsonb, best-effort structure, nullable
  high_visibility_flag?: boolean;   // true for specialist restrictions (e.g. physio plans)
  review_date?: string | null;
  deleted_at?: string | null;
}
```

### Example JSON
```json
{
  "id": "16a7...",
  "user_id": "5f2c...",
  "created_at": "2026-07-01T09:00:00Z",
  "provenance": "human_specialist_plan",
  "source_name": "physiotherapist",
  "raw_plan_text": "Avoid loaded knee flexion past ~90 degrees for 2 weeks...",
  "high_visibility_flag": true,
  "review_date": "2026-07-15"
}
```

### Validation rules
- `provenance: "human_specialist_plan"` should set `high_visibility_flag = true` by default at write time (application logic, not just a DB default, since it should also drive briefing behavior).
- A plan never blocks on `parsed_plan` succeeding — `raw_plan_text` alone is a valid, complete row (mirrors the raw_log non-blocking rule).

### Privacy/consent considerations
`human_specialist_plan` rows are clinical information and should be treated at the same sensitivity tier as `pain_event`. Never paraphrase a specialist's raw instruction in a way that could alter its clinical meaning — store and display verbatim as the source of truth, with `parsed_plan` as a convenience view only.

### MVP or later
**MVP.**

---

## 14. `plan_item`

### Purpose
Normalized, queryable breakdown of a `plan` into individual prescribed items — used for plan-vs-actual comparison (linking from `workout_session.plan_item_ref` and similar).

### Required fields
`id`, `plan_id`, `item_type`, `description`.

### Optional fields
`day_label`, `exercise_name`, `target_sets`, `target_reps`, `target_load`, `constraint_text`.

### Field types
```typescript
interface PlanItem {
  id: string;
  plan_id: string;
  item_type: "exercise" | "restriction" | "nutrition_target" | "recovery_protocol" | "general_guidance";
  description: string;
  day_label?: string;               // e.g. "Mon", "Day 1" — NOT a resolved calendar date at write time
  exercise_name?: string;
  target_sets?: number;
  target_reps?: number | "AMRAP";
  target_load?: number;
  constraint_text?: string;         // e.g. "RPE < 6", "no squatting below parallel"
}
```

### Example JSON
```json
{
  "id": "17b8...",
  "plan_id": "16a7...",
  "item_type": "restriction",
  "description": "no squatting below parallel until cleared",
  "constraint_text": "no squatting below parallel"
}
```

### Validation rules
`day_label` is intentionally kept as a loose label, not resolved to a calendar date at parse time — that resolution is a Stage-5-adjacent confirmation step ("should I map Mon/Tue/Thu/Fri to this coming week?", eval_04) and shouldn't be guessed silently by the parser.

### Privacy/consent considerations
Inherits sensitivity from its parent `plan` (i.e., a `plan_item` under a `human_specialist_plan` is clinical information).

### MVP or later
**MVP** (lightweight version — full day-to-date resolution UX can be basic in v0).

---

## 15. `adherence_record`

### Purpose
Captures both self-reported and (later) system-computed adherence over a period, with `provenance` making clear which is which — this directly encodes the eval_16/eval_19 requirement that a self-estimate never masquerade as a computed fact.

### Required fields
`id`, `user_id`, `period_start`, `period_end`, `provenance`, `created_at`.

### Optional fields
`self_reported_adherence_pct`, `computed_adherence_pct`, `deviations`, `note`.

### Field types
```typescript
interface AdherenceRecord {
  id: string;
  user_id: string;
  period_start: string;
  period_end: string;
  provenance: Extract<ProvenanceType, "raw_self_report" | "derived_metric">;
  self_reported_adherence_pct?: number | null;   // required if provenance = raw_self_report
  computed_adherence_pct?: number | null;        // required if provenance = derived_metric
  deviations?: Array<{ planned: string; actual: string; reason?: string }>;
  note?: string;
  created_at: string;
}
```

### Example JSON
```json
{
  "id": "18c9...",
  "user_id": "5f2c...",
  "period_start": "2026-06-30",
  "period_end": "2026-07-06",
  "provenance": "raw_self_report",
  "self_reported_adherence_pct": 80,
  "deviations": [
    { "planned": "cardio session", "actual": "walk", "reason": "fatigue" }
  ]
}
```

### Validation rules
`provenance = "raw_self_report"` requires `self_reported_adherence_pct` non-null and `computed_adherence_pct` null (and vice versa for `derived_metric`) — enforce with an application-level check; a Postgres `CHECK` constraint referencing two nullable columns and an enum works fine here too.

### Privacy/consent considerations
None beyond general canonical-memory tier.

### MVP or later
**MVP** for `raw_self_report` rows only. `derived_metric` (system computing real adherence % by joining `plan_item` against `canonical_event`) is a clearly-scoped **later** feature — worth stubbing the enum value now, not worth building the computation in v0.

---

## 16. `coach_briefing`

### Purpose
Stage 7 output object — the actual deliverable of the MVP. Bundles a human-readable markdown briefing and a machine-readable JSON context, both traceable back to the specific canonical events they summarize.

### Required fields
`id`, `user_id`, `window_start`, `window_end`, `generated_at`, `summary_markdown`, `disclaimer`.

### Optional fields
`json_context`, `flags`, `source_event_ids`, `plan_vs_actual`.

### Field types
```typescript
interface CoachBriefing {
  id: string;
  user_id: string;
  window_start: string;
  window_end: string;
  generated_at: string;
  summary_markdown: string;
  disclaimer: string;                 // non-null on every row, no exceptions
  json_context?: Record<string, unknown>;
  flags?: Array<
    "unconfirmed_events_present" | "low_confidence_fields_present" |
    "contradictory_log_unresolved" | "pain_flag_active" | "specialist_restriction_active"
  >;
  source_event_ids?: string[];        // canonical_event.id[] this briefing was built from
  plan_vs_actual?: Array<{ plan_id: string; deltas: Record<string, unknown> }>;
}
```

### Example JSON
```json
{
  "id": "19d0...",
  "user_id": "5f2c...",
  "window_start": "2026-06-30",
  "window_end": "2026-07-06",
  "generated_at": "2026-07-06T20:00:00Z",
  "summary_markdown": "## This Week\n\nTrained squat and bench...",
  "disclaimer": "User-reported data only. Not medical advice.",
  "flags": ["low_confidence_fields_present"],
  "source_event_ids": ["d802...", "d905...", "d906..."]
}
```

### Validation rules
- `disclaimer` is `NOT NULL` at the DB level — this is a case where a hard constraint is worth it, since "forgot the disclaimer" is exactly the kind of bug that shouldn't be catchable only in code review.
- If any `source_event_id` has `pain_event.high_visibility_flag = true` or an active `plan.high_visibility_flag = true` restriction, the corresponding `flags` entry must be set and that content must appear at the top of `summary_markdown`, not buried — enforced by application logic + covered by eval_11/eval_17/eval_20 as regression tests.

### Privacy/consent considerations
Any external agent reading this object via API must have done so through an authorized, revocable integration — record that access in `agent_run` (below), not here.

### MVP or later
**MVP.**

---

## 17. `consent_record`

### Purpose
Explicit, granular, revocable consent tracking. This table is what makes the "user-owned data layer" claim in the product thesis actually true rather than aspirational.

### Required fields
`id`, `user_id`, `consent_type`, `granted`, `granted_at`.

### Optional fields
`revoked_at`, `consent_version`, `note`.

### Field types
```typescript
interface ConsentRecord {
  id: string;
  user_id: string;
  consent_type: "llm_parsing" | "future_model_training" | "benchmarking_aggregation" | "specialist_dashboard_sharing";
  granted: boolean;
  granted_at: string;
  revoked_at?: string | null;
  consent_version?: string;    // which ToS/consent copy version was shown
  note?: string;
}
```

### Example JSON
```json
{
  "id": "20e1...",
  "user_id": "5f2c...",
  "consent_type": "llm_parsing",
  "granted": true,
  "granted_at": "2026-06-01T08:00:05Z",
  "consent_version": "v0.1"
}
```

### Validation rules
- `consent_type` values other than `llm_parsing` should default to `granted: false` and must never be inferred from a general ToS acceptance — each requires its own explicit opt-in action, per the product thesis's privacy-first stance.
- Revocation writes a new row's `revoked_at` (or updates the existing row) rather than deleting the consent history — you need to be able to prove what was and wasn't consented to at any point in time.

### Privacy/consent considerations
This table *is* the privacy/consent implementation — treat it as append-mostly, auditable, and exportable to the user on request ("here's your full consent history").

### MVP or later
**MVP** — at minimum, the `llm_parsing` consent_type must exist and be enforced before any `raw_log` is sent to a parsing model. The other three consent types are schema-ready now precisely so v1's "specialist dashboards / benchmarks / vertical model" features never have to retrofit consent — they just need a `granted: true` row to check before any code path touches that data.

---

## 18. `agent_run`

### Purpose
Access/audit log for every time an external agent or integration reads or writes AGym data on a user's behalf — the concrete implementation of the "access log visible to the user" requirement from the Coach Briefing spec (Stage 7, acceptance criteria).

### Required fields
`id`, `user_id`, `agent_identifier`, `action_type`, `occurred_at`.

### Optional fields
`window_requested`, `success`, `token_scope`, `note`.

### Field types
```typescript
interface AgentRun {
  id: string;
  user_id: string;
  agent_identifier: string;         // freeform label, e.g. "ChatGPT (manual paste)", "custom-integration-token-4f2a"
  action_type: "read_briefing" | "read_events" | "write_plan" | "read_json_context";
  occurred_at: string;
  window_requested?: { start: string; end: string } | null;
  success?: boolean;
  token_scope?: string;             // which auth scope/token this ran under, if API-based
  note?: string;
}
```

### Example JSON
```json
{
  "id": "21f2...",
  "user_id": "5f2c...",
  "agent_identifier": "manual-paste",
  "action_type": "read_briefing",
  "occurred_at": "2026-07-06T20:00:30Z",
  "success": true
}
```

### Validation rules
For the shortest useful vertical slice (manual copy/paste loop, no real API yet), `agent_identifier: "manual-paste"` is a valid and expected value — this table should be populated even before a real API/token system exists, so the audit habit and the UI for it ("see who's accessed your data") ship from day one rather than being bolted on when the API arrives.

### Privacy/consent considerations
This table exists *for* the user's benefit (transparency into access), not as a surveillance mechanism over the user — it should be visible to the user themselves in a simple list, on request, at all times.

### MVP or later
**MVP-lite.** Full API-token-scoped access logging is a later feature (once a real API exists), but the table and a trivial "manual-paste" logging call should exist from v0 so the access-log UI and habit aren't a retrofit.

---

## Object Relationship Summary

```
user_profile (1) ──< raw_log (N)
raw_log (1) ──< parsed_event (N, usually 1)
raw_log (1) ──< canonical_event (N, via source_raw_log_id)
canonical_event (1) ──< workout_session (0..1) ──< exercise_set (N)
canonical_event (1) ──< meal_event (0..1) ──< food_item (N)
canonical_event (1) ──< running_event (0..1)
canonical_event (1) ──< recovery_metric (0..1)
canonical_event (1) ──< body_metric (0..1)
canonical_event (1) ──< pain_event (0..1)
user_profile (1) ──< plan (N) ──< plan_item (N)
workout_session.plan_item_ref ──> plan_item.id   (plan-vs-actual link)
user_profile (1) ──< adherence_record (N)
user_profile (1) ──< coach_briefing (N) ── source_event_ids[] ──> canonical_event.id[]
user_profile (1) ──< consent_record (N)
user_profile (1) ──< agent_run (N)
```

## MVP vs. Later — Quick Reference

| Object | MVP | Notes |
|---|---|---|
| user_profile | ✅ | minimal fields required, rest opt-in |
| raw_log | ✅ | core |
| parsed_event | ✅ | core |
| canonical_event | ✅ | core |
| workout_session | ✅ | |
| exercise_set | ✅ | |
| meal_event | ✅ | |
| food_item | ✅ | no calorie/macro fields |
| running_event | ✅ | |
| recovery_metric | ✅ | sleep + mood only; HRV/soreness scales later |
| body_metric | ✅ | body weight only; other measurements later |
| pain_event | ✅ | sensitive but core to trust |
| plan | ✅ | |
| plan_item | ✅ | lightweight |
| adherence_record | ✅ (self-report only) | `derived_metric` computation is later |
| coach_briefing | ✅ | core deliverable |
| consent_record | ✅ (llm_parsing enforced; others schema-ready) | |
| agent_run | ✅ (manual-paste logging only) | full API-scoped logging is later |

No object in this list is purely "later" — everything is at least schema-present in v0, because retrofitting the *provenance* and *consent* model onto an existing dataset later is far more expensive than defining it correctly once, now, even if some computation (derived adherence %, device import, specialist dashboards) doesn't ship until v1+.

---

*End of v0 schema spec. Save as `docs/architecture/schemas.md`.*
