# AGym v0 — Schema & Behavior Deltas

Status: accepted — these amendments are **authoritative over `docs/plans/mvp-implementation-plan.md`** where they differ (per `docs/adr/0001-v0-source-of-truth.md`).

Scope: exact changes to the plan's §4 (data model), §8 (storage), and §9/Issue #9 (briefing). Nothing here adds backend, plans, or new screens.

---

## 1. New payload kind: `pain`

Add to the discriminated union in `src/domain/schemas.ts`:

```ts
export const PainPayloadSchema = z.object({
  kind: z.literal("pain"),
  bodyPart: z.string().nullable(),
  description: z.string(),
  severity: z.number().int().min(1).max(10).nullable(), // only if the user stated a number — NEVER inferred
  notes: z.string().nullable(),
});
```

Rules:

- Parser maps pain/discomfort/injury language to `pain`, not `note`. Low confidence → uncertainty flag, still `pain`.
- `severity` is null unless the user gave a number. The parser must not invent scales.
- **No diagnosis, treatment, cause, or risk fields exist in this payload. Do not add any without explicit product review.** AGym never diagnoses, recommends treatment, or makes medical claims — in schema, UI, or briefing text.
- Briefing: any `pain` event in the window renders in a dedicated "⚠ Pain / discomfort" section placed **immediately after the summary, before training** — never buried, never omitted.

## 2. Provenance and parser version on events

```ts
// DraftEventSchema — add:
parserVersion: z.string(),                 // e.g. "mock-v1"; copied from ParseResult.parserName

// CanonicalEventSchema — add:
provenance: z.literal("user_confirmed"),   // widen to a union later; never optional
originalPayload: EventPayloadSchema,       // snapshot of the DRAFT payload at parse time, before any user edit
```

- `originalPayload` is set at confirm time from the unedited draft; it is never updated afterward. It exists so parser corrections are not lost (`editedByUser` alone is insufficient). Internal only — never rendered in briefings.
- Both fields appear in JSON export. Exported events must be self-describing about trust level without knowing the app version.

## 3. Date/time semantics (replaces `occurredAt`)

Remove `occurredAt: z.string().datetime()` from `DraftEventSchema`. Replace with:

```ts
date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),   // local calendar date, required
time: z.string().regex(/^\d{2}:\d{2}$/).nullable(), // local HH:mm, only if the user stated one
```

- Most logs are date-granular ("yesterday", "slept badly"). A UTC instant fabricates precision the user never gave.
- Parser: relative dates resolve against the user-supplied default date; ambiguity → uncertainty flag on `date`. `time` defaults to null.
- Timeline grouping, briefing windows, and export all key on `date`.

## 4. Raw log and deletion rules

- `RawLog.text` is **immutable** after save. No edit path exists except `deleteAll`.
- Deleting a canonical event does **not** delete its source rawLog.
- `deleteAll` wipes everything: rawLogs, drafts, canonical events, and the quarantine key (`agym.v1.*`). UI returns to empty states.
- Drafts are session-scoped (not persisted); losing an unconfirmed parse on refresh is accepted — the rawLog survives and can be re-parsed.

## 5. Briefing rules

- Full output standard: `docs/briefing/coach-briefing-v0-standard.md` — **authoritative for v0 briefing markdown** (sections, order, wording rules).
- Briefings are **generated on demand, never stored** (overrides `data-model.md` §16).
- When raw user text (`sourceText`, notes, pain descriptions) appears in a briefing, it must be clearly marked as quoted user data (blockquote or "user wrote: …"), not interpolated into instruction-like prose. Briefings are consumed by LLMs; raw text is untrusted input and must not read as instructions to the consuming agent.
- Every briefing carries the fixed disclaimer: "User-reported log data only. Not medical advice."

## 6. localStorage limitations (v0 accepts these, disclosed)

- v0 stores health/fitness data in browser localStorage, **plaintext, unencrypted, not guaranteed durable** (browser eviction or "clear site data" destroys it).
- Mitigations required in v0:
  - call `navigator.storage.persist()` on app load where available;
  - DataPanel shows an export nudge (e.g. "Data lives only in this browser — export a backup");
  - README discloses the above in plain language.

## 7. Do NOT build in v0

- backend / Supabase / auth / RLS / API routes
- normalized event tables (`workout_session`, `exercise_set`, `meal_event`, `food_item`, …)
- exercise-name normalization (report names as logged)
- nutrition calculation (kcal/macro fields hold user-**stated** numbers only, never computed)
- stored briefings
- LLM parser (interface seam only)
- plan intake / `plan` / `plan_item`
- wearables / device import
- dashboards, charts, analytics
- medical advice, diagnosis, severity inference, or health-risk commentary

## Issue impact map

| Delta | Affected issues (`docs/plans/github-issues.md`) |
|---|---|
| pain payload | schema issue, parser issue, preview/editor, briefing |
| parserVersion / provenance / originalPayload | schema, parser, store, export |
| date/time semantics | schema, parser, timeline, briefing |
| deletion rules | storage adapter, data panel |
| briefing rules | briefing generator |
| localStorage limits | scaffold/app shell, data panel, README |
