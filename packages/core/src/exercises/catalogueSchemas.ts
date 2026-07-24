import { z } from 'zod';

export const CATALOGUE_SOURCE = 'hasaneyldrm/exercises-dataset';
export const CATALOGUE_SOURCE_COMMIT = '7455efae41b330c265e7cd4b78dfa848e7ce5ebd';

export const catalogueExerciseSchema = z.object({
  sourceId: z.string().regex(/^[0-9]{4}$/),
  name: z.string().trim().min(1),
  category: z.string().trim().min(1),
  bodyPart: z.string().trim().min(1),
  equipment: z.string().trim().min(1),
  muscleGroup: z.string().trim().min(1),
  secondaryMuscles: z.array(z.string().trim().min(1)),
  target: z.string().trim().min(1),
  instructions: z.record(z.string(), z.string()),
  instructionSteps: z.record(z.string(), z.array(z.string().min(1))),
});
export type CatalogueExercise = z.infer<typeof catalogueExerciseSchema>;

function dedupeKey(record: CatalogueExercise): string {
  return [record.name, record.equipment, record.bodyPart, record.target]
    .map((value) => value.trim().toLowerCase())
    .join('|');
}

/** Upstream carries a handful of exact duplicate records (same name/equipment/body_part/target, different id). Keep the lowest id. */
export function dedupeCatalogueExercises(records: CatalogueExercise[]): CatalogueExercise[] {
  const kept = new Map<string, CatalogueExercise>();
  for (const record of records) {
    const key = dedupeKey(record);
    const existing = kept.get(key);
    if (!existing || record.sourceId < existing.sourceId) kept.set(key, record);
  }
  return [...kept.values()].sort((a, b) => a.sourceId.localeCompare(b.sourceId));
}
