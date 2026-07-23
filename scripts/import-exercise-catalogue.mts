// Imports the pinned exercises-dataset commit's metadata (never media) into
// public.exercise_catalogue. See docs/research/exercise-dataset-evaluation.md
// for the license review and docs/research/exercise-catalogue-provenance.md
// for the record of the actual import run.
//
// Run with: npx tsx scripts/import-exercise-catalogue.mts
// Requires: AGYM_SUPABASE_URL, AGYM_SUPABASE_SERVICE_ROLE_KEY
import { createClient } from '@supabase/supabase-js';

import {
  CATALOGUE_SOURCE,
  CATALOGUE_SOURCE_COMMIT,
  catalogueExerciseSchema,
  dedupeCatalogueExercises,
  type CatalogueExercise,
} from '../packages/core/src/exercises/catalogueSchemas';

const UPSTREAM_URL = `https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/${CATALOGUE_SOURCE_COMMIT}/data/exercises.json`;

type UpstreamRecord = {
  id: string;
  name: string;
  category: string;
  body_part: string;
  equipment: string;
  muscle_group: string;
  secondary_muscles: string[];
  target: string;
  instructions: Record<string, string>;
  instruction_steps: Record<string, string[]>;
  // image, gif_url, media_id, attribution, created_at are intentionally never read: media is not redistributable by AGym.
};

function toCatalogueExercise(record: UpstreamRecord): CatalogueExercise {
  return {
    sourceId: record.id,
    name: record.name,
    category: record.category,
    bodyPart: record.body_part,
    equipment: record.equipment,
    muscleGroup: record.muscle_group,
    secondaryMuscles: record.secondary_muscles,
    target: record.target,
    instructions: record.instructions,
    instructionSteps: record.instruction_steps,
  };
}

async function main() {
  const url = process.env.AGYM_SUPABASE_URL;
  const serviceRoleKey = process.env.AGYM_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error('AGYM_SUPABASE_URL and AGYM_SUPABASE_SERVICE_ROLE_KEY must be set.');

  console.log(`Fetching ${CATALOGUE_SOURCE}@${CATALOGUE_SOURCE_COMMIT}...`);
  const response = await fetch(UPSTREAM_URL);
  if (!response.ok) throw new Error(`Could not fetch upstream dataset: HTTP ${response.status}`);
  const upstream = (await response.json()) as UpstreamRecord[];

  const parsed = upstream.map((record) => catalogueExerciseSchema.parse(toCatalogueExercise(record)));
  const deduped = dedupeCatalogueExercises(parsed);
  console.log(`Fetched ${upstream.length} records; ${deduped.length} after validation and dedup.`);

  const client = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const rows = deduped.map((record) => ({
    source: CATALOGUE_SOURCE,
    source_id: record.sourceId,
    source_commit: CATALOGUE_SOURCE_COMMIT,
    name: record.name,
    category: record.category,
    body_part: record.bodyPart,
    equipment: record.equipment,
    muscle_group: record.muscleGroup,
    secondary_muscles: record.secondaryMuscles,
    target: record.target,
    instructions: record.instructions,
    instruction_steps: record.instructionSteps,
  }));

  const { error } = await client.from('exercise_catalogue').upsert(rows, { onConflict: 'source,source_id' });
  if (error) throw new Error(`Import failed: ${error.message}`);

  console.log(`Imported ${rows.length} exercise_catalogue rows from ${CATALOGUE_SOURCE}@${CATALOGUE_SOURCE_COMMIT}.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
