# AGym MVP — GitHub Issues

Companion to `IMPLEMENTATION_PLAN.md`. 16 issues, each sized for one branch + one PR by a coding agent. Order is the dependency order; parallelizable issues are noted.

Label set used: `type:docs` `type:infra` `type:feature` `type:test` · `area:domain` `area:storage` `area:parser` `area:state` `area:ui` `area:briefing` `area:privacy` · `size:S` `size:M` · `mvp`

Branch convention: `issue/<number>-<slug>`. Every PR references its issue, passes CI, and touches nothing outside its stated scope.

> **Note:** Issues 3–6 have expanded agent-proof tickets in `docs/plans/tickets-03-06.md`, which **supersede** the summaries below (incl. the Issue 6 schema, which is amended by `docs/architecture/v0-schema-deltas.md`).

---

## Issue 1 — Add README with project charter and non-goals

**Labels:** `type:docs` `size:S` `mvp`
**Goal:** A README that keeps every future contributor (human or agent) pointed at the data-loop thesis and away from scope creep.
**Background:** AGym is a user-owned health/fitness data layer for AI agents, not an AI coach. The canonical loop: agent plan → user action → raw log → parsed event → user correction → canonical memory → Coach Briefing → next plan. Agents drift toward building coach features unless the charter is explicit.
**Scope:**
- `README.md`: one-paragraph thesis, the canonical loop (text diagram), MVP vertical slice description, explicit non-goals list (no coach, no auth, no backend, no wearables, no dashboards), privacy stance (all data local, export/delete always available), no-medical-claims statement, dev setup placeholder.
**Files:** `README.md`
**Acceptance criteria:**
- [ ] README contains thesis, loop, MVP slice, non-goals, privacy stance, medical disclaimer
- [ ] Non-goals section lists at least the items from IMPLEMENTATION_PLAN §12
- [ ] No feature promises beyond the MVP slice
**Tests/checks:** Markdown renders correctly on GitHub; spell-check pass.
**Out of scope:** Setup instructions that don't exist yet (added in Issue 3), logos, badges, roadmap beyond MVP.
**Risk notes:** Low. Main risk is writing a marketing doc instead of a working charter — keep it under ~120 lines.

---

## Issue 2 — Repo conventions: PR template, issue template, labels, definition of done

**Labels:** `type:docs` `type:infra` `size:S` `mvp`
**Goal:** Make agent-driven development predictable: every PR looks the same and states what it did not touch.
**Background:** Multiple small agent PRs need a uniform contract to be reviewable fast.
**Scope:**
- `.github/PULL_REQUEST_TEMPLATE.md`: linked issue, what changed, out-of-scope confirmation, test evidence, checklist (lint/typecheck/tests/build green).
- `.github/ISSUE_TEMPLATE/task.md`: mirrors the structure of this document's issues.
- `CONTRIBUTING.md`: branch naming, commit style, "domain logic is pure functions outside React", "no new dependencies without an issue", label definitions.
**Files:** `.github/PULL_REQUEST_TEMPLATE.md`, `.github/ISSUE_TEMPLATE/task.md`, `CONTRIBUTING.md`
**Acceptance criteria:**
- [ ] Opening a PR shows the template
- [ ] CONTRIBUTING documents branch naming, dependency policy, purity rule, and definition of done
**Tests/checks:** Manual: open a draft PR, confirm template renders.
**Out of scope:** CODEOWNERS, git hooks, semantic-release, changelog automation.
**Risk notes:** Low. Over-engineering risk — keep templates under 30 lines each.

---

## Issue 3 — Scaffold Vite + React + TypeScript + Vitest + lint

> **Expanded authoritative ticket:** `docs/plans/tickets-03-06.md#issue-3--scaffold-vite--react--typescript--vitest--lint`. Use that ticket for implementation; this summary is not sufficient.

**Labels:** `type:infra` `size:M` `mvp`
**Goal:** A clean-cloning repo where dev, build, test, and lint all run green.
**Background:** Foundation for everything; folder structure per IMPLEMENTATION_PLAN §1.
**Scope:**
- Vite React-TS template, strict `tsconfig` (`strict: true`, `noUncheckedIndexedAccess: true`).
- Deps: `react`, `react-dom`, `zustand`, `zod`. Dev: `vitest`, `@testing-library/react`, `@testing-library/user-event`, `jsdom`, `eslint`, `prettier`.
- Folder skeleton: `src/domain/`, `src/parser/`, `src/storage/`, `src/briefing/`, `src/state/`, `src/components/` with placeholder exports so `tsc` passes.
- One trivial passing test to prove the harness.
- README updated with real setup commands.
**Files:** `package.json`, `vite.config.ts`, `tsconfig.json`, `.eslintrc.cjs`, `.prettierrc`, `index.html`, `src/main.tsx`, `src/App.tsx`, folder stubs, `README.md`
**Acceptance criteria:**
- [ ] `npm run dev`, `build`, `test`, `lint` all succeed on clean clone
- [ ] Strict TS; zero `any` in committed code
- [ ] Only the listed dependencies present
**Tests/checks:** The trivial test passes; `vite build` output loads in a browser.
**Out of scope:** CI (Issue 4), app shell UI (Issue 5), CSS framework, router.
**Risk notes:** Template drift — pin to whatever `npm create vite@latest` currently generates and don't hand-roll config. Dependency creep is the failure mode to watch.

---

## Issue 4 — CI workflow: lint, typecheck, test, build on every PR

> **Expanded authoritative ticket:** `docs/plans/tickets-03-06.md#issue-4--ci-lint-typecheck-test-build-on-every-pr`. Use that ticket for implementation; this summary is not sufficient.

**Labels:** `type:infra` `size:S` `mvp`
**Goal:** No PR merges unless the whole pipeline is green.
**Background:** Agent-produced PRs need mechanical gating from day one.
**Scope:**
- `.github/workflows/ci.yml`: on PR + push to main, run `npm ci`, `lint`, `tsc --noEmit`, `vitest run`, `vite build`. Node LTS, npm cache enabled.
**Files:** `.github/workflows/ci.yml`
**Acceptance criteria:**
- [ ] Workflow triggers on PR and runs all four steps
- [ ] A deliberately broken test on a scratch branch fails CI
- [ ] Runtime under ~3 minutes
**Tests/checks:** Open a scratch PR with a failing assertion; verify red, then revert.
**Out of scope:** Deploy jobs, coverage reporting, matrix builds, caching beyond npm.
**Risk notes:** Low. Depends on Issue 3.

---

## Issue 5 — App shell: tab navigation and placeholder screens

> **Expanded authoritative ticket:** `docs/plans/tickets-03-06.md#issue-5--app-shell-tab-navigation-and-placeholder-screens`. Use that ticket for implementation; this summary is not sufficient.

**Labels:** `type:feature` `area:ui` `size:S` `mvp`
**Goal:** Navigable skeleton — Log | Timeline | Briefing | Data tabs — so every later UI issue lands into an existing slot.
**Background:** No router by design; tab state will live in the store later, local `useState` for now.
**Scope:**
- `App.tsx` with four tabs and placeholder components (`LogInput`, `EventTimeline`, `BriefingView`, `DataPanel`) each rendering a titled empty state.
- Minimal `app.css`; readable, unstyled-but-not-broken.
**Files:** `src/App.tsx`, `src/components/{LogInput,EventTimeline,BriefingView,DataPanel}.tsx`, `src/app.css`
**Acceptance criteria:**
- [ ] Four tabs switch content without page reload
- [ ] Each placeholder has a visible empty-state message
- [ ] Component test: clicking each tab renders its screen
**Tests/checks:** RTL test for tab switching; CI green.
**Out of scope:** Real functionality in any tab, store integration, styling polish, ParsePreview/EventEditor components.
**Risk notes:** Low. Depends on Issue 3.

---

## Issue 6 — Domain schemas: Zod models for logs, events, payloads, uncertainty

> **Expanded authoritative ticket:** `docs/plans/tickets-03-06.md#issue-6--domain-schemas-zod-models-amended-by-v0-schema-deltas`. Use that ticket for implementation (its schema block is amended by `docs/architecture/v0-schema-deltas.md`); this summary is not sufficient.

**Labels:** `type:feature` `area:domain` `size:M` `mvp`
**Goal:** The single source of truth for all data shapes, with types inferred from schemas.
**Background:** IMPLEMENTATION_PLAN §4. The schema IS the product — everything else is plumbing around it. `note` payload is the never-drop-data safety net.
**Scope:**
- `src/domain/schemas.ts`: `RawLogSchema`, `UncertaintyFlagSchema`, payload discriminated union (`workout`, `meal`, `bodyweight`, `sleep`, `note`), `DraftEventSchema`, `CanonicalEventSchema`. All records carry `schemaVersion: 1`. Metric units internally.
- `src/domain/types.ts`: `z.infer` exports only.
- `src/domain/ids.ts`: `newId()` wrapping `crypto.randomUUID()`.
**Files:** `src/domain/schemas.ts`, `src/domain/types.ts`, `src/domain/ids.ts`, `src/domain/schemas.test.ts`
**Acceptance criteria:**
- [ ] All schemas match IMPLEMENTATION_PLAN §4 field-for-field
- [ ] Valid and invalid samples for every payload kind covered by tests
- [ ] `CanonicalEventSchema` extends `DraftEventSchema` with `confirmedAt`, `editedByUser`
- [ ] No `any`; types only via `z.infer`
**Tests/checks:** Schema unit tests; a malformed-record sample fails parse with a useful error path.
**Out of scope:** Storage, migrations, parser, plan/briefing schemas, additional event types.
**Risk notes:** Highest-leverage design decision in the repo — schema changes later ripple everywhere. Reviewer should challenge field names and nullability here, not in later PRs. Depends on Issue 3.

---

## Issue 7 — StorageAdapter interface + in-memory implementation

**Labels:** `type:feature` `area:storage` `size:S` `mvp`
**Goal:** The async persistence contract everything programs against, plus a test double.
**Background:** Async interface means the later Supabase swap changes zero call sites. In-memory impl unblocks store and integration tests before localStorage lands.
**Scope:**
- `src/storage/StorageAdapter.ts`: `loadAll`, `saveRawLog`, `saveEvents` (upsert by id), `deleteEvent`, `exportAll`, `deleteAll` — all async, per IMPLEMENTATION_PLAN §8.
- `src/storage/inMemoryAdapter.ts` + shared contract test suite that any adapter implementation can run.
**Files:** `src/storage/StorageAdapter.ts`, `src/storage/inMemoryAdapter.ts`, `src/storage/adapterContract.test.ts`
**Acceptance criteria:**
- [ ] Interface matches §8 exactly
- [ ] Contract suite covers round-trip, upsert semantics, deleteAll, exportAll shape
- [ ] In-memory adapter passes the contract suite
**Tests/checks:** `vitest run` green; contract suite is exported as a reusable function (`runAdapterContract(adapterFactory)`).
**Out of scope:** localStorage (Issue 8), quarantine, migrations, Supabase.
**Risk notes:** Low, but get upsert semantics (by `id`) pinned in tests now — ambiguity here corrupts data later. Depends on Issue 6.

---

## Issue 8 — localStorage adapter with validation quarantine and migrations stub

**Labels:** `type:feature` `area:storage` `size:M` `mvp`
**Goal:** Real local-first persistence that never crashes on bad data.
**Background:** Keys `agym.v1.rawLogs`, `agym.v1.events`. Records are Zod-validated on load; invalid ones are quarantined, not dropped and not fatal.
**Scope:**
- `src/storage/localStorageAdapter.ts` implementing `StorageAdapter`.
- On load: validate each record; failures move to `agym.v1.quarantine` with a console warning.
- `src/storage/migrations.ts`: v1 passthrough only, with the shape for future versions.
**Files:** `src/storage/localStorageAdapter.ts`, `src/storage/migrations.ts`, `src/storage/localStorageAdapter.test.ts`
**Acceptance criteria:**
- [ ] Passes the shared adapter contract suite (from Issue 7)
- [ ] Hand-corrupted record in localStorage → app loads, record in quarantine key, warning logged
- [ ] `deleteAll` clears all `agym.*` keys including quarantine
- [ ] `exportAll` returns pretty-printed JSON containing rawLogs, events, `exportedAt`, `schemaVersion`
**Tests/checks:** jsdom localStorage tests incl. quarantine and corrupt-JSON-at-key cases.
**Out of scope:** IndexedDB, encryption, sync, Supabase, real migrations.
**Risk notes:** Quarantine logic is the easy-to-get-wrong part: one bad record must not discard its siblings. Test that explicitly. Depends on Issues 6, 7.

---

## Issue 9 — Parser interface and fixture test harness

> **Expanded authoritative ticket:** `docs/plans/tickets-09-10.md#issue-9--parser-interface-and-invariant-fixture-harness`. Use that ticket for implementation; this summary is not sufficient. The harness is **invariant-based, not deep-equal golden JSON**.

**Labels:** `type:feature` `type:test` `area:parser` `size:S` `mvp`
**Goal:** The `Parser` contract plus an invariant fixture harness, before any parsing logic exists.
**Background:** IMPLEMENTATION_PLAN §5. The interface must be identical for mock and future LLM parser. Contract: never throws; nothing silently dropped; low confidence → uncertainty flag.
**Scope:**
- `src/parser/Parser.ts`: `ParseInput` (`text`, `defaultDate`), `ParseResult` (`events`, `parserName`, `warnings`), `Parser` interface.
- `src/parser/fixtures/`: **invariant fixture harness** — fixture specs carry raw input + `defaultDate` + invariant assertions (no throw, required DraftEvent fields, payload kinds, selected extracted values, uncertainty flags, sourceText coverage, `parserVersion` presence). No generated-ID or exact-full-JSON assertions. 2 seed fixtures wired to a placeholder parser that returns a single note event.
**Files:** `src/parser/Parser.ts`, `src/parser/fixtures/*`, `src/parser/fixtureHarness.ts`, `src/parser/fixtureHarness.test.ts`
**Acceptance criteria:**
- [ ] Interface matches §5
- [ ] Harness discovers fixture specs automatically; adding one requires no code change
- [ ] Placeholder parser + 2 seed fixtures pass
**Tests/checks:** Harness test green; a failing invariant reports the fixture id and which invariant failed.
**Out of scope:** Real parsing rules (Issue 10), LLM anything.
**Risk notes:** Low. Keep `ParseResult` free of UI concerns. Depends on Issue 6.

---

## Issue 10 — Mock parser: rule-based parsing with invariant fixtures and fuzz test

> **Expanded authoritative ticket:** `docs/plans/tickets-09-10.md#issue-10--mock-parser-deterministic-rules-against-the-invariant-fixtures--fuzz`. Use that ticket for implementation; this summary is not sufficient. Fixture set: `docs/evals/parser-fixtures-v0.md` (PF-001…PF-025).

**Labels:** `type:feature` `area:parser` `size:M` `mvp`
**Goal:** A deterministic parser good enough to exercise the full correction loop.
**Background:** IMPLEMENTATION_PLAN §6. Misparses are acceptable — they feed the correction UX. What is not acceptable: throwing, or losing text.
**Scope:**
- `src/parser/mockParser.ts`: segment on newlines/`;`; classify via keyword/regex (workout `3x8@80kg` patterns, meal keywords, `slept`, bare bodyweight, **pain/discomfort/injury language → `pain`**, else note); extract numbers; lbs→kg with uncertainty flag; relative dates from `defaultDate`; `time` null unless explicitly stated; missing values → `null` + flag; exercise names as-logged (no normalization).
- Pain rules: severity only if user-stated; no diagnosis, cause, risk, or treatment output of any kind. Nutrition numbers user-stated only; never computed.
- 25 realistic fixtures per `docs/evals/parser-fixtures-v0.md` (PF-001…PF-025), invariant-style.
- Fuzz test: 500 seeded-random strings → never throws, ≥1 event for non-empty input, sourceText coverage preserved, garbage becomes note with uncertainty flag.
**Files:** `src/parser/mockParser.ts`, `src/parser/mockParser.test.ts`, `src/parser/fixtures/*` (PF-001…PF-025)
**Acceptance criteria:**
- [ ] All 25 fixtures pass via the Issue 9 harness
- [ ] Fuzz test passes; unclassifiable text → note event with uncertainty flag
- [ ] Every parsed event carries `sourceText` and `rawLogId`
- [ ] lbs inputs converted to kg with a flag on the converted field
**Tests/checks:** Fixtures + fuzz + unit tests for date resolution ("yesterday", no date).
**Out of scope:** LLM parser, parser settings UI, exercise-name dictionaries beyond ~20 common lifts, natural-language time beyond yesterday/today.
**Risk notes:** Rabbit-hole risk — resist making it smart. Cap effort: if a rule takes >30 lines, emit a note event with a flag instead. Depends on Issue 9.

---

## Issue 11 — Zustand store wired to storage and parser

**Labels:** `type:feature` `area:state` `size:M` `mvp`
**Goal:** The single store connecting parser, storage, and (soon) UI.
**Background:** IMPLEMENTATION_PLAN §7. Components never touch storage directly; domain logic stays in pure functions.
**Scope:**
- `src/state/store.ts`: state (`rawLogs`, `drafts`, `events`, `ui`) and actions (`hydrate`, `submitLog`, `updateDraft`, `confirmDraft`, `confirmAll`, `discardDraft`, `deleteEvent`, `deleteAll`) exactly per §7.
- Adapter injected at store creation (in-memory for tests, localStorage in `main.tsx`).
- `confirmDraft` computes `editedByUser` by comparing against the original parsed draft.
**Files:** `src/state/store.ts`, `src/state/store.test.ts`, `src/main.tsx`
**Acceptance criteria:**
- [ ] `hydrate` loads persisted data; `ui.hydrated` flips true
- [ ] `submitLog` persists RawLog and populates `drafts` via the mock parser
- [ ] `confirmDraft` persists a CanonicalEvent retrievable after a fresh `hydrate`
- [ ] `editedByUser` true iff the draft was modified before confirm
- [ ] Store contains no parsing or briefing logic
**Tests/checks:** Store tests with in-memory adapter covering every action; integration: submit → edit → confirm → rehydrate → event present.
**Out of scope:** Any React components, selectors optimization, devtools config beyond default.
**Risk notes:** `editedByUser` comparison needs a stable definition (deep-equal of `payload` + `date` + `time`) — pin it in a test. Depends on Issues 7, 8, 10.

---

## Issue 12 — Log input screen

**Labels:** `type:feature` `area:ui` `size:S` `mvp`
**Goal:** The entry point of the loop: paste messy text, hit Parse.
**Background:** Raw text is sacred — stored verbatim before any parsing happens.
**Scope:**
- `LogInput.tsx`: textarea, optional date override (defaults to now), Parse button (disabled when empty), calls `submitLog`, clears only on success, shows parser `warnings`.
- After successful parse, surface the ParsePreview area (placeholder link/anchor until Issue 13).
**Files:** `src/components/LogInput.tsx`, `src/components/LogInput.test.tsx`
**Acceptance criteria:**
- [ ] Empty input → button disabled
- [ ] Submit stores RawLog verbatim (assert exact string round-trip incl. whitespace)
- [ ] Textarea clears only after `submitLog` resolves
- [ ] Date override changes `defaultDate` passed to parser
**Tests/checks:** RTL tests for all criteria with in-memory adapter.
**Out of scope:** ParsePreview/EventEditor (Issue 13), voice input, file import, autosave drafts.
**Risk notes:** Low. Depends on Issues 5, 11.

---

## Issue 13 — Parse preview and event editor (core UX)

**Labels:** `type:feature` `area:ui` `size:M` `mvp`
**Goal:** The correction loop: review drafts, edit anything, confirm or discard.
**Background:** This screen is the product hypothesis. It must make uncertainty visible and correction cheap.
**Scope:**
- `ParsePreview.tsx`: lists drafts from the last parse; confirm-all / discard-all bar; explicit "nothing parsed" state with raw text shown.
- `EventEditor.tsx`: per-draft editable type, `date`, `time`, payload fields; type change swaps the payload form, preserving mappable fields; per-event confirm/discard; shows `sourceText`.
- `UncertaintyBadge.tsx`: renders flags per field; editing a flagged field clears its flag.
**Files:** `src/components/{ParsePreview,EventEditor,UncertaintyBadge}.tsx` + tests
**Acceptance criteria:**
- [ ] Every payload field of every kind is editable
- [ ] Type switch preserves `date`, `time`, `sourceText`, and `parserVersion`, maps compatible fields, flags the rest
- [ ] Confirm sets `editedByUser` correctly (via store)
- [ ] Editing a flagged field removes that flag; badge disappears
- [ ] Zero-draft state shows raw text and a "save as note" escape hatch
**Tests/checks:** RTL: edit→confirm flow, flag clearing, type switch, confirm-all; integration test from IMPLEMENTATION_PLAN §9.6 lands here.
**Out of scope:** Timeline rendering, keyboard shortcuts, undo, drag-reorder, styling polish.
**Risk notes:** Biggest UI issue — if it feels too large mid-flight, split `UncertaintyBadge`+flag-clearing into a follow-up PR rather than growing this one. Depends on Issues 11, 12.

---

## Issue 14 — Timeline view of canonical events

**Labels:** `type:feature` `area:ui` `size:S` `mvp`
**Goal:** Read-back of canonical memory: what actually happened, by day.
**Background:** Reverse-chron, grouped by day; uncertainty still visible post-confirmation.
**Scope:**
- `EventTimeline.tsx`: day-grouped reverse-chron list, per-kind compact rendering, uncertainty badges, per-event delete with confirm dialog, empty state.
**Files:** `src/components/EventTimeline.tsx`, `src/components/EventTimeline.test.tsx`
**Acceptance criteria:**
- [ ] Events grouped by local calendar day, newest first
- [ ] Each kind renders its key facts (workout: exercises+sets; meal: description+kcal; etc.)
- [ ] Delete requires confirmation and persists through rehydrate
- [ ] Flags visible on canonical events
**Tests/checks:** RTL with seeded store: grouping, delete flow, empty state.
**Out of scope:** Editing canonical events, filtering, search, charts, pagination/virtualization.
**Risk notes:** Low. Group by the event's `date` field (string key) — never derive the day from a timestamp; there is no `occurredAt` in v0, so classic timezone-grouping bugs cannot occur unless someone reintroduces timestamp math. Depends on Issues 11, 13.

---

## Issue 15 — Coach Briefing generator (pure function)

> **Expanded authoritative ticket:** `docs/plans/tickets-15-16.md#issue-15--coach-briefing-generator-pure-function`. Use that ticket for implementation; this summary is not sufficient. Output rules: `docs/briefing/coach-briefing-v0-standard.md`.

**Labels:** `type:feature` `area:briefing` `size:M` `mvp`
**Goal:** The payoff artifact: `(events, {from, to}) → markdown` a user hands to any AI coach.
**Background:** IMPLEMENTATION_PLAN §9 issue 9. States gaps explicitly, never interpolates, carries a data-quality section and a fixed disclaimer.
**Scope:**
- `src/briefing/generateBriefing.ts`: pure function `(events: CanonicalEvent[], { from, to, generatedAt }) → markdown`, implementing `docs/briefing/coach-briefing-v0-standard.md` — all 11 sections in order, incl. **⚠ Pain / discomfort immediately after Summary**, fixed disclaimer "User-reported log data only. Not medical advice.", raw user text quoted/marked, data-quality section, export metadata.
- Filters and groups by `date` (YYYY-MM-DD string), never by timestamp. No store/storage/React imports; `generatedAt` from opts, not the clock.
**Files:** `src/briefing/generateBriefing.ts`, `src/briefing/generateBriefing.test.ts`, `src/briefing/__snapshots__/`
**Acceptance criteria:**
- [ ] Known 14-day event fixture → stable markdown (deterministic; snapshot allowed as regression net)
- [ ] Empty range → valid "no data" briefing with disclaimer and all sections present
- [ ] Gaps stated explicitly; no invented averages over missing days
- [ ] Flags from events appear in data-quality section
- [ ] Semantic tests (not only snapshots) for: empty range, pain rendering, raw-text quoting, uncertainty flags, forbidden medical/advice language, no computed nutrition, no exercise normalization, `date`-based filtering
- [ ] Zero React/storage imports
**Tests/checks:** Semantic assertions per the expanded ticket + optional snapshots; volume math verified by hand in test comments.
**Out of scope:** UI (Issue 16), PDF, JSON context export (Issue 17), trend charts, recommendations of any kind.
**Risk notes:** Scope creep into "insights" — the briefing reports, it does not advise. Volume math errors are silent; hand-check test values. Depends on Issue 6.

---

## Issue 16 — Briefing view: date range, copy, download

> **Expanded authoritative ticket:** `docs/plans/tickets-15-16.md#issue-16--briefing-view-date-range-copy-download`. Use that ticket for implementation; this summary is not sufficient.

**Labels:** `type:feature` `area:ui` `area:briefing` `size:S` `mvp`
**Goal:** Make the briefing usable: pick range, read it, copy or download the .md.
**Scope:**
- `BriefingView.tsx`: from/to date inputs (default = last 14 **local** dates), generated markdown only — **no stored briefing model**, regenerate on range change; rendered via `<pre>`/basic output (no markdown-renderer dep unless already approved); copy-to-clipboard and download (`agym-briefing-YYYY-MM-DD.md`) carry the exact markdown; disclaimer visible in the UI; no medical/advice language in component copy.
**Files:** `src/components/BriefingView.tsx`, `src/components/BriefingView.test.tsx`
**Acceptance criteria:**
- [ ] Default range = last 14 days; changing range regenerates
- [ ] Copy puts exact markdown on clipboard
- [ ] Download produces correctly named .md with identical content
- [ ] Empty-data briefing renders without error
**Tests/checks:** RTL with seeded store; clipboard mocked.
**Out of scope:** Markdown styling perfection, share links, scheduling, multiple briefing templates.
**Risk notes:** Low. Depends on Issues 11, 15.

---

## Issue 17 — Data panel: full JSON export

**Labels:** `type:feature` `area:privacy` `size:S` `mvp`
**Goal:** User owns the data: one click → complete, re-validatable JSON file.
**Background:** Export is a privacy commitment and the future agent/API context format's ancestor.
**Scope:**
- `DataPanel.tsx` export section: "Export all data" button → downloads `agym-export-YYYY-MM-DD.json` from `adapter.exportAll()` (rawLogs, events, `exportedAt`, `schemaVersion`).
**Files:** `src/components/DataPanel.tsx`, `src/components/DataPanel.test.tsx`
**Acceptance criteria:**
- [ ] Export file contains all rawLogs and events
- [ ] Every record in the export re-validates against the Zod schemas (test does this)
- [ ] Works when store is empty (valid empty export)
**Tests/checks:** RTL + schema re-validation round-trip test.
**Out of scope:** Import, selective export, CSV, API endpoint, delete-all (Issue 18).
**Risk notes:** Low. Depends on Issues 8, 11.

---

## Issue 18 — Delete-all with typed confirmation + privacy pass

**Labels:** `type:feature` `area:privacy` `size:S` `mvp`
**Goal:** Credible "your data, your call": irreversible local wipe, and the privacy/medical-disclaimer copy audited across the app.
**Background:** Privacy-first design and no-medical-claims are product requirements, not polish.
**Scope:**
- DataPanel delete section: requires typing `delete`, double-step confirm, calls `deleteAll`, UI returns to empty states everywhere.
- Privacy pass: footer or Data-tab text stating all data stays on device; disclaimer present in app UI and briefing; README privacy section verified against actual behavior.
**Files:** `src/components/DataPanel.tsx` + test, `src/App.tsx`, `README.md`
**Acceptance criteria:**
- [ ] Delete disabled until exact string `delete` typed
- [ ] After delete: all `agym.*` localStorage keys gone, all tabs show empty states, refresh stays empty
- [ ] Disclaimer visible in UI and in every generated briefing
- [ ] README privacy claims match implemented behavior exactly
**Tests/checks:** RTL delete flow; post-delete rehydrate test; grep-level check that no network calls exist in the codebase (no `fetch` outside comments).
**Out of scope:** Per-record retention policies, encryption, account deletion (no accounts), GDPR tooling.
**Risk notes:** Verify the no-network claim before writing it — one stray analytics import falsifies the README. Depends on Issues 8, 11, 17.

---

## Summary table

| # | Title | Labels | Depends on |
|---|-------|--------|------------|
| 1 | README charter + non-goals | docs | — |
| 2 | Repo conventions + templates | docs, infra | — |
| 3 | Scaffold Vite/React/TS/Vitest | infra | — |
| 4 | CI workflow | infra | 3 |
| 5 | App shell with tabs | ui | 3 |
| 6 | Domain schemas (Zod) | domain | 3 |
| 7 | StorageAdapter + in-memory | storage | 6 |
| 8 | localStorage adapter + quarantine | storage | 6, 7 |
| 9 | Parser interface + fixture harness | parser, test | 6 |
| 10 | Mock parser + fixtures + fuzz | parser | 9 |
| 11 | Zustand store wiring | state | 7, 8, 10 |
| 12 | Log input screen | ui | 5, 11 |
| 13 | Parse preview + event editor | ui | 11, 12 |
| 14 | Timeline view | ui | 11, 13 |
| 15 | Briefing generator (pure) | briefing | 6 |
| 16 | Briefing view UI | ui, briefing | 11, 15 |
| 17 | JSON export | privacy | 8, 11 |
| 18 | Delete-all + privacy pass | privacy | 8, 11, 17 |

Parallel tracks after Issue 6: storage (7→8), parser (9→10), and briefing generator (15) can proceed concurrently; UI serializes after 11.
