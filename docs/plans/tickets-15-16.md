# AGym — Agent-Proof Tickets: Issues 15–16

**Status: this file expands Issues 15–16 only. For other issues: `docs/plans/github-issues.md` (3–6: `tickets-03-06.md`; 9–10: `tickets-09-10.md`).**

Where these differ from the `github-issues.md` summaries, **these win**. Output rules per `docs/briefing/coach-briefing-v0-standard.md` (the Standard). Schema per `docs/plans/tickets-03-06.md` Issue 6 (`date`/`time`, **no `occurredAt`**). Global constraints of `tickets-03-06.md` apply. No coach features: the briefing reports; it never advises.

---

## Issue 15 — Coach Briefing generator (pure function)

**Goal:** `generateBriefing(events, { from, to, generatedAt }) → markdown` implementing the Standard exactly.
**Depends on:** Issue 6.

### Exact files

```
src/briefing/generateBriefing.ts
src/briefing/generateBriefing.test.ts
src/briefing/__snapshots__/          # snapshots allowed as a regression net, never the only assertion
```

### Implementation notes

- Pure function: no imports from state/storage/React; no `Date.now()`/`new Date()` — `generatedAt` comes from opts; no locale-dependent formatting.
- Filter by `event.date` string comparison (`from <= date <= to`, inclusive). **Never derive a day from any timestamp.**
- Sort: `date` asc, `time` asc with null first, `confirmedAt` tie-break.
- All 11 sections of the Standard, in order, always present; empty sections state emptiness per the Standard's wording.
- Disclaimer verbatim: "User-reported log data only. Not medical advice."
- All user text (pain descriptions, note text, meal descriptions when quoted) rendered as quoted user data (`> user wrote: "…"` or blockquote), never as plain prose.
- Data-quality closing sentence verbatim: "Uncertain fields are flagged for user review."

### Acceptance criteria

- [ ] Signature matches the Standard's contract exactly
- [ ] Section order matches the Standard; every section present even when empty
- [ ] Pain section immediately after Summary; renders date/time/bodyPart-or-"unspecified"/severity-or-"not stated"/quoted description; nothing else
- [ ] No computed kcal/protein; missing-nutrition counts stated
- [ ] Exercise names byte-identical to payload values (no casing/normalization changes)
- [ ] No invented averages/trends over missing days; bodyweight delta only when ≥2 values
- [ ] Determinism: same inputs twice → identical string (deep-equal appropriate here)
- [ ] Zero React/storage/state imports

### Test strategy (semantic assertions REQUIRED; snapshots optional extras)

1. **Empty range:** zero events → all 11 sections present, zero counts, "No pain/discomfort events…" line, disclaimer present.
2. **Pain events:** fixture with pain (severity stated + not stated) → correct rendering; section ordered directly after Summary.
3. **Raw text quoting:** note/pain descriptions appear only inside quote markers; test asserts the raw string is preceded by a quote marker, never bare.
4. **Uncertainty flags:** flags surface in Data quality grouped by date · kind · field; count correct.
5. **Forbidden-language scan:** after stripping quoted user lines (blockquotes), output matches none of: `recommend|advice|should|consider|diagnos|treat(ment)?|risk|prescri|improve your|try (to|adding)` — quoted user text is exempt (users may write "should"), generator prose is not. Disclaimer and fixed sentences are chosen to pass this scan.
6. **No computed nutrition:** meal with description "eggs and toast", kcal null → output contains no kcal number for it.
7. **No normalization:** exercise "sqt 3x5" stays "sqt".
8. **Date filtering:** events with `date` on/off boundary days prove inclusive `date`-based filtering (no timestamp involved).
9. Snapshot of the Standard's canonical example input (regression net only).

### Edge cases

- Two events same date+time → `confirmedAt` tie-break keeps output stable.
- `time` present renders `HH:mm`; null renders nothing (no "00:00" fabrication).
- Workout set with reps but null weight renders "—" for weight and is excluded from any totals, with the exclusion stated.
- Flag `field` paths are rendered as-is (they're already user-meaningful per schema).

### Out of scope

UI (Issue 16), JSON context export, PDF, storing briefings, any trend/insight/score computation, plan-vs-actual (no plans in v0).

### Reviewer checklist

- [ ] Diff limited to the three listed paths
- [ ] Forbidden-language test present and non-trivial (would fail if "consider deloading" were added)
- [ ] Semantic assertions cover all 8 categories above — a reviewer deleting the snapshots should still see meaningful coverage
- [ ] Standard's "Must not" list checked line-by-line against the implementation

---

## Issue 16 — Briefing view: date range, copy, download

**Goal:** make the generated briefing usable. Thin UI over the pure function; **no stored briefing model** — regenerate on every render/range change.
**Depends on:** Issues 11, 15.

### Exact files

```
src/components/BriefingView.tsx
src/components/BriefingView.test.tsx
```

### Implementation notes

- From/to date inputs; default range = **last 14 local calendar dates** (to = today local, from = today − 13 days), computed once on mount from the system clock, formatted `YYYY-MM-DD` locally (no UTC conversion — a user at 00:30 must not get yesterday's date).
- Calls `generateBriefing(events, { from, to, generatedAt: new Date().toISOString() })` with events from the store; regenerates when range changes. Markdown is derived state — never persisted, never put in the store.
- Render inside `<pre>` (or equivalent) — **no markdown-renderer dependency**; adding one requires a flagged approval, not a quiet install.
- Copy button → exact markdown string to clipboard, with visible confirmation.
- Download button → file named `agym-briefing-YYYY-MM-DD.md` (today, local), byte-identical content to the rendered markdown.
- The disclaimer is visible in the UI: it's the briefing's own disclaimer block near the top of the rendered output; the view must not hide/truncate it (no collapsed preview that cuts it off).
- UI copy: neutral labels only ("Generate", "Copy", "Download") — no coach/advice language.

### Acceptance criteria

- [ ] Default range = last 14 local dates; changing either input regenerates
- [ ] Copy puts the exact markdown on the clipboard (mocked; assert string equality)
- [ ] Download produces `agym-briefing-YYYY-MM-DD.md` with identical content
- [ ] Empty-data briefing renders without error and still shows the disclaimer
- [ ] No briefing stored: nothing written to the store or the storage adapter by this component (assert adapter spy not called)
- [ ] No new dependencies in `package.json` diff
- [ ] No medical/advice language in component copy (reuse Issue 15's forbidden-term list against the component's static strings)

### Test strategy

RTL with seeded in-memory store: default-range calculation (mock system time, incl. a near-midnight local time), regenerate-on-change, clipboard equality, download filename/content, empty state, adapter-not-called assertion.

### Edge cases

- from > to: disable generation and show a neutral inline message; never throw.
- Clipboard API unavailable (older jsdom/browser): button shows a "select and copy manually" fallback state rather than crashing.
- Range spanning zero events renders the Standard's empty sections, not a blank screen.

### Out of scope

Markdown rendering polish, share links, scheduling, multiple templates, JSON context export, storing or caching briefings.

### Reviewer checklist

- [ ] Component contains zero briefing-content logic — all content comes from `generateBriefing`
- [ ] No store/adapter writes; markdown is derived state only
- [ ] Local-date (not UTC) default-range math, tested near midnight
- [ ] No new deps; `<pre>`-style rendering
