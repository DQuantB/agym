# AGym — Agent-Proof Tickets: Issues 9–10

**Status: this file expands Issues 9–10 only. For all other issues, use `docs/plans/github-issues.md` (Issues 3–6: `docs/plans/tickets-03-06.md`).**

Where these tickets differ from the summaries in `github-issues.md`, **these win**. Precedence per `docs/adr/0001-v0-source-of-truth.md`. Schema shapes per `docs/plans/tickets-03-06.md` Issue 6. Fixture set per `docs/evals/parser-fixtures-v0.md`.

The global constraints of `docs/plans/tickets-03-06.md` apply (strict TS, pure logic outside React, no backend/auth/network, no new dependencies, no coach features). Additionally for the parser: **no LLM anything** — the mock parser is deterministic rules only; the `Parser` interface is the future seam.

---

## Issue 9 — Parser interface and invariant fixture harness

**Goal:** the `Parser` contract plus an invariant-based fixture harness, before any parsing logic exists. **No deep-equal golden JSON.**
**Depends on:** Issue 6.

### Exact files

```
src/parser/Parser.ts               # ParseInput, ParseResult, Parser interface
src/parser/fixtureHarness.ts       # loads fixture specs, applies global + per-fixture invariants
src/parser/fixtures/PF-000a.fixture.ts   # seed fixture 1 (see below)
src/parser/fixtures/PF-000b.fixture.ts   # seed fixture 2
src/parser/fixtureHarness.test.ts  # runs seeds against the placeholder parser
src/parser/placeholderParser.ts    # returns one note event covering the whole input — deleted in Issue 10
```

### Interface (per IMPLEMENTATION_PLAN §5, amended field names per tickets-03-06 Issue 6)

```ts
export interface ParseInput {
  text: string;
  defaultDate: string;   // YYYY-MM-DD — local date the log applies to unless the text overrides it
}
export interface ParseResult {
  events: DraftEvent[];  // may never be empty for non-empty input
  parserName: string;    // e.g. "placeholder-v0", "mock-v1"
  warnings: string[];    // parser-level issues, surfaced in the preview UI later
}
export interface Parser {
  parse(input: ParseInput): Promise<ParseResult>;
}
```

### Fixture spec shape (harness contract)

Each fixture is a `.fixture.ts` file exporting a spec object; the harness auto-discovers all of them (e.g. `import.meta.glob`) — **adding a fixture requires no harness change**:

```ts
export interface FixtureSpec {
  id: string;                        // "PF-001"
  defaultDate: string;               // "2026-07-11"
  input: string;                     // raw log text
  minEvents?: number;
  kindsInclude?: EventPayload["kind"][];
  kindsExclude?: EventPayload["kind"][];
  expectDate?: string;               // asserted on all events unless overridden per-check
  flags?: Array<{ fieldIncludes: string }>;   // a flag must exist whose field contains this substring
  forbidValues?: Array<{ pathIncludes: string; value: unknown }>; // e.g. weightKg must never be 185
  assert?: (result: ParseResult) => void;     // escape hatch for fixture-specific checks (vitest asserts inside)
}
```

### Global invariants (harness applies to EVERY fixture automatically)

1. `parse()` resolves — never throws/rejects.
2. Every event passes `DraftEventSchema.parse` (hence has `parserVersion`, `sourceText`, `uncertaintyFlags`, valid `date`/`time`).
3. Every `event.parserVersion` is non-empty and equals `result.parserName`.
4. Every `sourceText` is a verbatim substring of `input`.
5. Coverage: every non-whitespace character of `input` (excluding `;` and newlines) appears in at least one `sourceText`.
6. `time === null` on every event unless the fixture's `assert` checks a stated time.
7. No generated IDs are asserted anywhere.

### Seed fixtures (2, using the invariant format)

- `PF-000a`: input `"just a note to myself"` → minEvents 1, kindsInclude `["note"]`, text covered.
- `PF-000b`: input `"random 42 nonsense"` → minEvents 1, kindsInclude `["note"]`, forbidValues: no numeric field equals 42.

Both must pass against `placeholderParser` (which returns a single `note` event with the whole input as `sourceText` and an uncertainty flag).

### Acceptance criteria

- [ ] Interface matches the block above exactly
- [ ] Harness auto-discovers `*.fixture.ts`; adding a pair requires no code change
- [ ] Harness enforces all 7 global invariants on every fixture
- [ ] A failing invariant reports the fixture id and which invariant failed (readable, not a diff of two JSON blobs)
- [ ] No deep-equal comparison of full ParseResult/JSON anywhere in the harness
- [ ] Placeholder parser + 2 seed fixtures pass; `test:run` green

### Test strategy

`fixtureHarness.test.ts` runs the harness over the seeds with the placeholder parser. Add one deliberate-failure unit test: a spec with an impossible invariant against the placeholder must fail with a message containing the fixture id.

### Edge cases

- Empty-string input: define now — harness treats `input.trim() === ""` as invalid fixture (parser behavior for empty input is Issue 10's fuzz concern, not a fixture).
- Multi-byte characters (emoji) must survive the substring/coverage checks — implement coverage on code points, not bytes.

### Out of scope

Real parsing rules (Issue 10), the 25 PF fixtures (Issue 10), LLM parser, parser settings UI.

### Reviewer checklist

- [ ] `ParseResult` free of UI concerns; no React/store imports under `src/parser/`
- [ ] Harness failure messages name fixture id + invariant
- [ ] No snapshot files, no `expected.json` deep-equal pattern
- [ ] Coverage invariant implemented on code points; test with an emoji seed string

---

## Issue 10 — Mock parser: deterministic rules against the invariant fixtures + fuzz

**Goal:** a deterministic, intentionally dumb parser good enough to exercise the correction loop. Misparses are fine; throwing or losing text is not.
**Depends on:** Issue 9.

### Exact files

```
src/parser/mockParser.ts
src/parser/mockParser.test.ts          # date/time units + fuzz test
src/parser/fixtures/PF-001.fixture.ts … PF-025.fixture.ts   # from docs/evals/parser-fixtures-v0.md
(delete src/parser/placeholderParser.ts; seeds PF-000a/b keep passing against mockParser)
```

### Implementation rules (deterministic; cap: any single rule >30 lines → emit note + flag instead)

- Segment on newlines and `;`. Each event's `sourceText` = its segment, verbatim.
- Classify per segment: `NxM`/`3x8@80kg` patterns + common lift words (~20, hard-coded list) → `workout`; meal keywords (`kcal|cal|ate|breakfast|lunch|dinner|snack|protein|shake|brekkie`) → `meal`; `slept|sleep` → `sleep`; bare `82.4kg|181 lbs` with weigh-in context → `bodyweight`; pain/discomfort/injury words (`pain|hurt|sore|ache|tweak|pull|strain-as-user-word`) → `pain`; else → `note` with flag.
- **Pain:** `severity` only when the user stated a number (e.g. `6/10`) — never inferred from intensity words. `bodyPart` extracted from a small body-part word list or null. Description stays verbatim-adjacent. **The parser must never produce diagnosis, cause, risk, or treatment language in any field.**
- **Nutrition:** `kcal`/`proteinG` only from user-stated numbers; never computed or estimated.
- **Exercise names as logged** — no dictionary mapping beyond classification; the ~20-lift list decides *workout-ness*, it never rewrites the name.
- **Units:** `lbs`→kg (×0.453592, round 0.1) with an uncertainty flag on the converted field. Bare unitless numbers in weight position → value + flag, or null + flag; never a silent guess of unit.
- **Date/time:** `date` = `defaultDate`; `yesterday`/`today` resolve against it; other relative dates → `defaultDate` + flag on `date`. `time` only from explicit `HH:mm`; words like morning/evening → `time: null`. Ambiguity → flag, never fabricated precision.
- Missing values → `null` + flag. Unclassifiable segment → `note` + flag. Nothing is ever dropped.
- `parserName`/`parserVersion`: `"mock-v1"`.

### Acceptance criteria

- [ ] All 25 fixtures `PF-001`–`PF-025` pass via the Issue 9 harness, including every "must not" (encoded as `forbidValues`/`assert`)
- [ ] Seed fixtures PF-000a/b still pass
- [ ] Fuzz test passes (spec below)
- [ ] Pain: PF-016–PF-019 prove body-part capture, stated-severity-only, and zero advisory/diagnostic output
- [ ] Date/time: unit tests for `yesterday`, `today`, no-date, explicit `13:00`, and "morning/evening → null"
- [ ] lbs→kg conversions flagged (PF-005, PF-011)
- [ ] Exercise names as-logged (PF-001: `Squat` stays capitalized, `bench` stays lowercase)

### Fuzz test spec

- 500 strings from a **seeded** PRNG (fixed seed committed — deterministic CI): random lengths 1–500, mixed alphanumerics, punctuation, emoji, `;`, newlines, fitness-ish tokens.
- For every non-empty (post-trim) string: never throws; returns ≥1 event; all events pass `DraftEventSchema`; coverage invariant holds; unclassifiable input yields `note` events carrying an uncertainty flag.
- Empty/whitespace-only input: returns ≥1 `note` event flagged as empty, or a defined `warnings` entry — pick one, test it, document it in a code comment.

### Edge cases

- `3x8` with no weight → reps extracted, `weightKg: null` (+ flag), never a guessed load.
- `100kg` inside a workout segment is a load, not a bodyweight event (context beats bare-number rule).
- Multiple `@` or malformed patterns (`3x@kg`) → degrade to note + flag, don't throw.
- Decimal commas (`82,4kg`), 12-hour times (`7am`), non-English text: **out of scope** — must not throw; degrade to note/flag.
- A segment matching both pain and workout words (PF-020's second segment "knee started aching on set 3") → pain wins for that segment; the workout lives in its own segment.

### Out of scope

LLM parser, parser settings UI, exercise-name dictionaries beyond the ~20-lift classification list, natural-language time beyond yesterday/today, mood/recovery scoring of any kind.

### Reviewer checklist

- [ ] Deterministic: same input + defaultDate → identical output (test runs parser twice, deep-equals the two results — the ONLY place deep-equal is appropriate)
- [ ] No rule exceeds the 30-line cap; no "smart" heuristics crept in
- [ ] Grep the diff for advisory language (`should`, `recommend`, `rest`, `see a doctor`, `ice`) — none in parser output paths
- [ ] Severity never derived from adjectives; kcal never derived from foods
- [ ] Fuzz seed committed; CI-deterministic
- [ ] Fixture specs match `docs/evals/parser-fixtures-v0.md` — deviations documented in the PR description per fixture id
