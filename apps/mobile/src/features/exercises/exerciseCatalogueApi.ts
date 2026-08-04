import type { SupabaseClient } from '@supabase/supabase-js';

export const CATALOGUE_BODY_PARTS = [
  'back', 'cardio', 'chest', 'lower arms', 'lower legs', 'neck', 'shoulders', 'upper arms', 'upper legs', 'waist',
] as const;

export type CatalogueExercise = {
  id: string;
  name: string;
  category: string;
  bodyPart: string;
  equipment: string;
  muscleGroup: string;
  secondaryMuscles: string[];
  target: string;
  instructions: Record<string, string>;
};

type CatalogueRow = {
  id: string;
  name: string;
  category: string;
  body_part: string;
  equipment: string;
  muscle_group: string;
  secondary_muscles: string[] | null;
  target: string;
  instructions: Record<string, string> | null;
};

function fromRow(row: CatalogueRow): CatalogueExercise {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    bodyPart: row.body_part,
    equipment: row.equipment,
    muscleGroup: row.muscle_group,
    secondaryMuscles: row.secondary_muscles ?? [],
    target: row.target,
    instructions: row.instructions ?? {},
  };
}

// Columns a search word may match against. Searching only `name` meant a query
// like "barbell" or "biceps" (equipment/target, not name) or word order like
// "press bench" (vs. "Bench press") returned nothing even though a matching
// exercise existed.
const SEARCHABLE_COLUMNS = ['name', 'target', 'muscle_group', 'equipment', 'category', 'body_part'] as const;

function searchWords(text: string): string[] {
  return text
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/[,.()%]/g, ''))
    .filter((word) => word.length > 0);
}

export async function searchExerciseCatalogue(
  client: SupabaseClient,
  query: { text: string; bodyPart?: string | null },
  limit = 30,
): Promise<CatalogueExercise[]> {
  let request = client
    .from('exercise_catalogue')
    .select('id, name, category, body_part, equipment, muscle_group, secondary_muscles, target, instructions')
    .order('name', { ascending: true })
    .limit(limit);

  // Each word must match at least one searchable column (its own OR group);
  // calling .or() once per word ANDs the groups together, so "barbell chest"
  // finds chest exercises using a barbell regardless of word order or which
  // column each word actually matches.
  for (const word of searchWords(query.text)) {
    request = request.or(SEARCHABLE_COLUMNS.map((column) => `${column}.ilike.%${word}%`).join(','));
  }
  if (query.bodyPart) request = request.eq('body_part', query.bodyPart);

  const { data, error } = await request;
  if (error) throw new Error(`AGYM could not search the exercise catalogue: ${error.message}`);
  return (data ?? []).map(fromRow);
}
