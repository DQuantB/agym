# AGym MVP — Implementation Plan for Coding Agent

> **AUTHORITATIVE for v0** (per `docs/adr/0001-v0-source-of-truth.md`), as amended by
> `docs/architecture/v0-schema-deltas.md` — the deltas override §4/§8/§9 where they differ.

Target: local-first vertical slice. Raw text log → parse → editable preview → confirm → canonical event → Coach Briefing markdown → JSON export.

Stack: TypeScript, Vite, React. No backend, no auth, no deploy. Supabase later via storage adapter swap.

---

## 1. Repo structure

Single Vite app. No monorepo, no packages/ split — premature.

```
agym/
├── README.md
├── package.json
├── vite.config.ts            # includes vitest config
├── tsconfig.json
├── .eslintrc.cjs / .prettierrc
├── index.html
└── src/
    ├── main.tsx
    ├── App.tsx               # tab shell: Log | Timeline | Briefing | Data
    ├── domain/
    │   ├── schemas.ts        # Zod schemas — single source of truth
    │   ├── types.ts          # z.infer exports only
    │   └── ids.ts            # newId() (crypto.randomUUID wrapper)
    ├── parser/
    │   ├── Parser.ts         # interface + ParseResult
    │   ├── mockParser.ts     # rule-based, MVP
    │   ├── mockParser.test.ts
    │   └── fixtures/         # invariant fixture specs (PF-*.fixture.ts) — see tickets-09-10
    ├── storage/
    │   ├── StorageAdapter.ts # async interface
    │   ├── localStorageAdapter.ts
    │   └── localStorageAdapter.test.ts
    ├── briefing/
    │   ├── generateBriefing.ts   # pure: CanonicalEvent[] → markdown string
    │   └── generateBriefing.test.ts
    ├── state/
    │   └── store.ts          # Zustand
    └── components/
        ├── LogInput.tsx
        ├── ParsePreview.tsx
        ├── EventEditor.tsx
        ├── UncertaintyBadge.tsx
        ├── EventTimeline.tsx
        ├── BriefingView.tsx
        └── DataPanel.tsx     # export JSON, delete all
```

Rules for the agent:
- Domain logic (parsing, briefing, validation) lives in pure functions outside React. Components are thin.
- Tests colocated (`foo.test.ts` next to `foo.ts`).
- No CSS framework decision-making: use plain CSS modules or a single `app.css`. Do not add Tailwind/UI kits.

## 2. Initial files (scaffold commit)

`package.json` deps: `react`, `react-dom`, `zustand`, `zod`. Dev: `vite`, `typescript`, `vitest`, `@testing-library/react`, `@testing-library/user-event`, `jsdom`, `eslint`, `prettier`.

Files created in scaffold: everything under repo root above, with `domain/`, `parser/`, `storage/`, `briefing/` as stubs exporting typed placeholders, plus `npm run dev / build / test / lint` all green.

## 3. Component list

| Component | Responsibility |
|---|---|
| `App` | Tab navigation, mounts store hydration |
| `LogInput` | Textarea + optional date override + "Parse" button. Saves RawLog, runs parser, pushes drafts to store |
| `ParsePreview` | List of draft events from last parse. Confirm-all / discard-all bar |
| `EventEditor` | One draft event: editable type, time, payload fields; per-event confirm/discard |
| `UncertaintyBadge` | Renders uncertainty flags on a field/event; visually distinct |
| `EventTimeline` | Canonical events, reverse-chron, grouped by day; delete single event |
| `BriefingView` | Date-range picker (default 14 days) + rendered markdown + "Copy" + "Download .md" |
| `DataPanel` | "Export all JSON" (download), "Delete all data" (typed confirmation) |

No router. Tabs via store `ui.activeTab`.

## 4. Data model (`src/domain/schemas.ts`)

> **⚠ SUPERSEDED IN PART.** The schema below is the original draft. The reconciled, authoritative v0 schema is **`docs/plans/tickets-03-06.md` Issue 6**, amended per `docs/architecture/v0-schema-deltas.md`. Do not implement this section directly. Key differences: **`occurredAt` does not exist in v0** — events use `date: YYYY-MM-DD` + `time: HH:mm | null`; **`pain` is a first-class payload kind**; `DraftEvent` requires `parserVersion`; `CanonicalEvent` additionally requires `provenance: "user_confirmed"` and `originalPayload`.

Zod first, infer types. Everything carries `schemaVersion`.

```ts
export const RawLogSchema = z.object({
  id: z.string(),
  text: z.string().min(1),
  loggedAt: z.string().datetime(),   // ISO
  source: z.literal("manual"),       // widen later: 'agent' | 'import'
  schemaVersion: z.literal(1),
});

export const UncertaintyFlagSchema = z.object({
  field: z.string(),                 // "date", "payload.weightKg", "type"
  reason: z.string(),                // human-readable
});

// Discriminated union of payloads
export const WorkoutPayloadSchema = z.object({
  kind: z.literal("workout"),
  exercises: z.array(z.object({
    name: z.string(),
    sets: z.array(z.object({
      reps: z.number().int().nullable(),
      weightKg: z.number().nullable(),
      rpe: z.number().nullable(),
    })),
  })),
  durationMin: z.number().nullable(),
  notes: z.string().nullable(),
});
export const MealPayloadSchema = z.object({
  kind: z.literal("meal"),
  description: z.string(),
  kcal: z.number().nullable(),
  proteinG: z.number().nullable(),
});
export const BodyweightPayloadSchema = z.object({ kind: z.literal("bodyweight"), weightKg: z.number() });
export const SleepPayloadSchema = z.object({ kind: z.literal("sleep"), durationH: z.number().nullable(), quality: z.enum(["poor","ok","good"]).nullable() });
export const NotePayloadSchema = z.object({ kind: z.literal("note"), text: z.string() }); // fallback — nothing is ever dropped

export const EventPayloadSchema = z.discriminatedUnion("kind", [
  WorkoutPayloadSchema, MealPayloadSchema, BodyweightPayloadSchema, SleepPayloadSchema, NotePayloadSchema,
]);

export const DraftEventSchema = z.object({
  id: z.string(),
  rawLogId: z.string(),
  occurredAt: z.string().datetime(), // ⚠ STALE — do not implement; v0 uses date/time (deltas §3)
  payload: EventPayloadSchema,
  uncertaintyFlags: z.array(UncertaintyFlagSchema),
  sourceText: z.string(),            // the raw segment this came from
  schemaVersion: z.literal(1),
});

export const CanonicalEventSchema = DraftEventSchema.extend({
  confirmedAt: z.string().datetime(),
  editedByUser: z.boolean(),         // true if user changed anything before confirm
  // ⚠ INCOMPLETE — v0 also requires provenance: "user_confirmed" and originalPayload
  //   (and parserVersion on DraftEvent). See deltas §2 / tickets-03-06 Issue 6.
});
```

Notes:
- `note` payload is the safety net: unparseable text becomes a note event with an uncertainty flag, never silently lost.
- Briefings are generated on demand, not stored.
- Metric units internally (kg); parser converts lbs.

## 5. Parser abstraction (`src/parser/Parser.ts`)

```ts
export interface ParseInput {
  text: string;
  defaultDate: string;        // ISO — user-selected or now
}
export interface ParseResult {
  events: DraftEvent[];       // may be empty
  parserName: string;         // "mock-v1" | "llm-v1"
  warnings: string[];         // parser-level issues, shown in preview
}
export interface Parser {
  parse(input: ParseInput): Promise<ParseResult>;
}
```

Contract:
- Never throws on bad input — worst case returns one `note` event covering the whole text.
- Every event keeps `sourceText` so the user can see what produced it.
- Anything low-confidence gets an `uncertaintyFlag`, not a guess presented as fact.

## 6. Mock parser first, LLM parser later

**MockParser (build now).** Deterministic rules:
- Split text into segments on newlines and `;`.
- Classify per segment by keyword/regex: `NxM` / `3x8@80kg` patterns + known exercise words → workout; `kcal|ate|breakfast|lunch|dinner|protein` → meal; `slept|sleep` → sleep; bare `82.4kg|181 lbs` → bodyweight; else → note.
- Extract numbers where patterns match; missing values → `null` + uncertainty flag.
- Relative dates ("yesterday") adjust the event `date` from `defaultDate`; ambiguous date → flag on `date`. (v0 has no `occurredAt` — deltas §3; `time` is null unless the user stated HH:mm.)

Good enough to validate the loop UX. It will misparse — that's the point: it exercises the correction flow.

**LlmParser (later, not in MVP issues).** Same `Parser` interface. Prompt → JSON → validate with `DraftEventSchema`; validation failure → fall back to note events. User-provided API key, browser-side, opt-in. Because the interface, the preview, and the correction flow don't change, this is a drop-in swap. Do not build until the mock loop works end-to-end.

Parser selection: `const parser: Parser = mockParser;` in one file. No settings UI yet.

## 7. State management

Zustand, single store, no middleware except `devtools` in dev.

```ts
interface AgymStore {
  rawLogs: RawLog[];
  drafts: DraftEvent[];          // current parse session only
  events: CanonicalEvent[];
  ui: { activeTab: Tab; hydrated: boolean };

  hydrate(): Promise<void>;                       // load from adapter on mount
  submitLog(text: string, defaultDate: string): Promise<void>;  // save raw, parse, set drafts
  updateDraft(id: string, patch: Partial<DraftEvent>): void;
  confirmDraft(id: string): Promise<void>;        // → canonical, persist
  confirmAll(): Promise<void>;
  discardDraft(id: string): void;
  deleteEvent(id: string): Promise<void>;
  deleteAll(): Promise<void>;
}
```

Rationale: app is one user, one screen at a time — Redux/Context ceremony not warranted. Store calls the storage adapter; components never touch storage directly.

## 8. Local storage

`localStorage` behind an async adapter (async so Supabase swap changes zero call sites):

```ts
export interface StorageAdapter {
  loadAll(): Promise<{ rawLogs: RawLog[]; events: CanonicalEvent[] }>;
  saveRawLog(log: RawLog): Promise<void>;
  saveEvents(events: CanonicalEvent[]): Promise<void>;   // upsert by id
  deleteEvent(id: string): Promise<void>;
  exportAll(): Promise<string>;                          // pretty JSON of everything
  deleteAll(): Promise<void>;
}
```

- Keys: `agym.v1.rawLogs`, `agym.v1.events`. JSON arrays.
- On load, validate each record with Zod; invalid records go to `agym.v1.quarantine` and a console warning — never crash on bad data.
- `schemaVersion` in every record; a `migrations.ts` exists but contains only v1 passthrough.
- localStorage over IndexedDB: data volume for one user validating an MVP is trivial; IndexedDB is complexity with no payoff yet.

## 9. Test plan

Vitest + React Testing Library. No Playwright yet.

1. **Parser fixture tests** (highest value). *(Superseded: v0 uses the invariant fixture harness — no expected-JSON deep equality. See `docs/plans/tickets-09-10.md` and the 25 fixtures in `docs/evals/parser-fixtures-v0.md`.)* Assert event kinds, key values, and uncertainty flags via invariants. Add a fixture for every misparse found during dogfooding.
2. **Schema tests**: valid/invalid samples per event type; quarantine behavior on corrupt localStorage.
3. **Storage tests**: round-trip save/load, upsert semantics, exportAll shape, deleteAll leaves keys empty (jsdom localStorage).
4. **Briefing tests**: semantic assertions per `docs/plans/tickets-15-16.md` (snapshots optional regression net); empty range → "no data" briefing; uncertainty flags appear in output.
5. **Component tests**: EventEditor edit → confirm marks `editedByUser`; ParsePreview confirm-all; DataPanel delete-all requires typed confirmation.
6. **Integration test**: render App with in-memory adapter, paste text → parse → edit one field → confirm → event in timeline → briefing contains it.

CI: single GitHub Actions workflow — `lint`, `tsc --noEmit`, `vitest run`, `vite build` on PR.

## 10 + 11. GitHub issues, ordered, with acceptance criteria

**#1 Scaffold: Vite + React + TS + Vitest + CI**
- `npm run dev/build/test/lint` all succeed on clean clone
- CI workflow runs and passes on PR
- Folder structure from §1 exists with typed stubs

**#2 Domain schemas and types**
- All schemas from §4 implemented in `domain/schemas.ts`, types inferred in `types.ts`
- Schema unit tests pass for valid + invalid samples of every payload kind
- No `any` in domain code

**#3 Storage adapter + localStorage implementation**
- `StorageAdapter` interface as §8; localStorage impl passes round-trip, upsert, quarantine, exportAll, deleteAll tests
- In-memory adapter also implemented (for tests)
- Corrupt record in localStorage does not crash load; lands in quarantine key

**#4 Parser interface + mock parser + fixtures**
- `Parser` interface as §5; mock parser passes the invariant fixture set (PF-001…PF-025, `docs/evals/parser-fixtures-v0.md`)
- Never throws: fuzz test with random strings always returns ≥1 event
- Unmatched text becomes note event with uncertainty flag; lbs→kg conversion flagged

**#5 Zustand store wired to storage + parser**
- Store shape as §7; `hydrate` loads persisted data; all actions persist through adapter
- Integration test: submitLog → drafts populated; confirmDraft → event persisted and reloadable

**#6 Log input screen**
- Textarea + date override + Parse button; empty input disabled
- Submit saves RawLog and populates drafts; textarea clears only after parse succeeds
- Raw text is preserved verbatim in storage

**#7 Parse preview + event editor (the core UX)**
- Each draft shows type, time, payload fields, `sourceText`, uncertainty badges
- Every field editable; type change swaps payload form and preserves what it can
- Per-event confirm/discard + confirm-all/discard-all; confirmed events set `editedByUser` correctly
- Zero-event parse shows explicit "nothing parsed" state with raw text intact

**#8 Timeline view**
- Reverse-chron canonical events grouped by day; per-event delete with confirm
- Uncertainty badges visible on canonical events
- Empty state present

**#9 Coach Briefing generator + view**
- **Superseded/expanded:** implement briefing output from `docs/briefing/coach-briefing-v0-standard.md` and Issues 15–16 / `docs/plans/tickets-15-16.md`.
- Pure function: `(events, {from, to, generatedAt}) → markdown`; generated on demand, never stored.
- Briefing sections include fixed disclaimer, summary counts, prominent pain/discomfort section, training, nutrition, bodyweight, sleep, notes, data quality, and export metadata.
- Explicitly states gaps rather than interpolating; raw user text is quoted/marked; no medical/advice language.
- UI supports copy-to-clipboard and download `.md`; semantic tests are required, snapshots optional.

**#10 Data panel: JSON export + delete all**
- Export downloads one JSON file: rawLogs + events + exportedAt + schemaVersion
- Exported JSON re-validates against schemas
- Delete-all requires typing "delete"; wipes all keys; UI returns to empty states

**#11 Uncertainty flags end-to-end polish**
- Flag rendering consistent across preview, timeline, briefing
- Editing a flagged field in EventEditor clears that flag
- Fixture-driven test proves a flag travels parse → confirm → briefing

**#12 README + dogfood pass**
- README: what AGym is (data layer, not a coach), loop diagram, run instructions, privacy note (all data local), no-medical-claims note
- File 5+ real logs; every misparse found becomes a parser fixture (committed)

Dependency chain: #1 → #2 → (#3, #4 in parallel) → #5 → #6 → #7 → #8 → #9 → #10 → #11 → #12.

## 12. What NOT to build yet

- Auth, accounts, Supabase, any backend or API routes
- LLM parser (interface stub only), API-key settings UI
- Plan intake micro-app / agent write endpoint (the other half of the contract — after the read loop is validated)
- Charts, streaks, PRs, analytics dashboards, trainer dashboard
- Mobile app, PWA/offline-sync machinery, wearable integrations
- Multi-user, sharing, benchmarks
- Router, i18n, design system, dark mode, Tailwind
- Deployment, error tracking, telemetry
- IndexedDB, service workers, encryption at rest

Each of these delays the only question that matters: will a user paste messy logs, correct the parse, and get a briefing worth handing to their AI coach?

## 13. Suggested first PR

**Superseded by `docs/plans/tickets-03-06.md`: start with Issue 3 only.**

First implementation PR: **Issue 3 — scaffold Vite + React + TypeScript + Vitest + lint**. Do not include schemas, parser, storage, tabs, or briefing behavior in that PR.

Why this slice: it creates the clean toolchain and package scripts that every later agent PR must use. Required verification after Issue 3: `npm ci && npm run lint && npm run typecheck && npm run test:run && npm run build`.

Then proceed one issue per branch/PR using the expanded tickets where present: Issue 4 (CI), Issue 5 (app shell), Issue 6 (schemas), Issue 9/10 (parser), Issue 15/16 (briefing).
