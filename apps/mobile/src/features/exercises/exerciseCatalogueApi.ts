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

  const text = query.text.trim();
  if (text) request = request.ilike('name', `%${text}%`);
  if (query.bodyPart) request = request.eq('body_part', query.bodyPart);

  const { data, error } = await request;
  if (error) throw new Error(`AGYM could not search the exercise catalogue: ${error.message}`);
  return (data ?? []).map(fromRow);
}
