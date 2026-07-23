# Exercise catalogue import provenance

Records the actual import event, distinct from `docs/research/exercise-dataset-evaluation.md` (the pre-decision license/quality spike).

## Source

- **Upstream:** `hasaneyldrm/exercises-dataset`, commit `7455efae41b330c265e7cd4b78dfa848e7ce5ebd` (pinned; see the evaluation doc for the license conclusion).
- **License scope imported:** MIT-licensed non-media fields only (`name`, `category`, `body_part`, `equipment`, `muscle_group`, `secondary_muscles`, `target`, `instructions`, `instruction_steps`). `media_id`, `image`, `gif_url`, and `attribution` are never read by the import script — media is out of scope per the evaluation doc.
- **Import script:** `scripts/import-exercise-catalogue.mts` (`npm run import:exercise-catalogue`).
- **Destination:** `public.exercise_catalogue` (migration `supabase/migrations/20260723180000_add_exercise_catalogue.sql`), keyed uniquely on `(source, source_id)` so re-running the import is idempotent (upsert).

## What the import does

1. Fetches `data/exercises.json` at the pinned commit directly from `raw.githubusercontent.com`.
2. Validates every record against `packages/core/src/exercises/catalogueSchemas.ts`'s `catalogueExerciseSchema` (Zod) — a malformed upstream record fails the whole run rather than silently importing bad data.
3. Runs `dedupeCatalogueExercises`, which collapses exact `name`+`equipment`+`body_part`+`target` duplicates and keeps the lowest `source_id` (see the 6 known duplicate pairs listed in the evaluation doc).
4. Upserts into `exercise_catalogue` via a `service_role` Supabase client.

## Verification performed

All performed locally, against a Docker Supabase instance reset to current migrations (not the hosted project — see "Not yet done" below).

| Check | Result |
|---|---|
| `npm run typecheck` / `npm run lint` / `npm run test:run` (root, including `packages/core`) | PASS |
| `cd apps/mobile && npm run typecheck && npm run lint && npm test -- --run` | PASS |
| `supabase db reset --local` (applies `20260723180000_add_exercise_catalogue.sql`) | PASS |
| `supabase/tests/exercise-catalogue.sql` via real `psql`: authenticated read, browser insert/update/delete rejected, `service_role` write allowed | 5/5 PASS |
| `npm run import:exercise-catalogue` against local Supabase | Fetched 1,324 records; **1,318 after validation and dedup** (6 duplicates collapsed, matching the evaluation doc exactly); all 1,318 upserted successfully |
| Post-import sanity query | 1,318 total rows, all 10 `body_part` enum values represented, e.g. 73 rows match `name ilike '%bench%'` |

One real bug found and fixed during this validation: the initial migration granted `service_role` only implicit RLS bypass, not the base table-level `INSERT`/`UPDATE` privilege the import script actually needs (this codebase's established pattern is writes via `SECURITY DEFINER` RPCs called as `authenticated`, not direct `service_role` table writes — this table is the first exception, since it's public reference data with no per-user ownership). Fixed by adding an explicit `grant select, insert, update on public.exercise_catalogue to service_role;` in the migration.

## Not yet done

- **Hosted import.** This import has only been run against local Docker Supabase. The hosted `agym-alpha` project's `exercise_catalogue` table exists once this migration is deployed, but is empty until `npm run import:exercise-catalogue` is run against it with `AGYM_SUPABASE_URL`/`AGYM_SUPABASE_SERVICE_ROLE_KEY` pointed at hosted. Deliberately not run yet.
- **Device testing.** The mobile `ExercisePicker`/`ExerciseDetail` UI has only been exercised through mocked-client unit tests (`exerciseCatalogueApi.test.ts`), not on a real device — consistent with not pushing a new build until the current build is validated.
