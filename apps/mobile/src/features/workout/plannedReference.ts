import type { ActualExercise, ActualSet, GymPlan } from './workoutApi';

export type PlannedSet = { reps: number; weight_kg?: number | null; rest_seconds?: number };
export type PlannedExercise = { client_id: string; name: string; sets: PlannedSet[] };

export type PlannedSetRef =
  | { kind: 'planned'; exerciseName: string; plannedSetCount: number; set: PlannedSet }
  | { kind: 'extra_set'; exerciseName: string; plannedSetCount: number }
  | { kind: 'added_exercise' }
  | { kind: 'unmatched' };

function normalizedName(name: string): string {
  return name.trim().toLowerCase();
}

export function findPlannedExercise(
  plan: GymPlan | null,
  actual: Pick<ActualExercise, 'client_id' | 'name' | 'user_added'>,
): PlannedExercise | null {
  if (!plan || actual.user_added) return null;
  const byId = plan.exercises.find((exercise) => exercise.client_id === actual.client_id);
  if (byId) return byId;
  const byName = plan.exercises.find((exercise) => normalizedName(exercise.name) === normalizedName(actual.name));
  return byName ?? null;
}

export function findPlannedSet(
  plan: GymPlan | null,
  actual: Pick<ActualExercise, 'client_id' | 'name' | 'user_added'>,
  setIndex: number,
): PlannedSetRef {
  if (actual.user_added) return { kind: 'added_exercise' };
  const plannedExercise = findPlannedExercise(plan, actual);
  if (!plannedExercise) return { kind: 'unmatched' };
  const plannedSet = plannedExercise.sets[setIndex];
  if (!plannedSet) return { kind: 'extra_set', exerciseName: plannedExercise.name, plannedSetCount: plannedExercise.sets.length };
  return { kind: 'planned', exerciseName: plannedExercise.name, plannedSetCount: plannedExercise.sets.length, set: plannedSet };
}

export function formatKg(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : String(value);
}

function formatPlannedSetText(set: PlannedSet): string {
  const weight = set.weight_kg === null || set.weight_kg === undefined ? 'bodyweight' : `${formatKg(set.weight_kg)} kg`;
  const rest = typeof set.rest_seconds === 'number' ? ` · rest ${set.rest_seconds}s` : '';
  return `${weight} × ${set.reps}${rest}`;
}

export function formatPlannedSetLabel(ref: PlannedSetRef): string {
  switch (ref.kind) {
    case 'planned':
      return `◇ Planned · ${formatPlannedSetText(ref.set)}`;
    case 'extra_set':
      return `+ Extra set · not in the agent plan (${ref.plannedSetCount} planned)`;
    case 'added_exercise':
      return '+ Added exercise · not in the agent plan';
    case 'unmatched':
      return '◇ Planned reference unavailable';
  }
}

export function formatPlannedDelta(
  ref: PlannedSetRef,
  actual: Pick<ActualSet, 'reps' | 'weight_kg'>,
): string | null {
  if (ref.kind !== 'planned') return null;
  const parts: string[] = [];
  const plannedWeight = ref.set.weight_kg ?? null;
  const actualWeight = actual.weight_kg ?? null;
  if (plannedWeight !== actualWeight && plannedWeight !== null && actualWeight !== null) {
    const diff = actualWeight - plannedWeight;
    parts.push(`${diff > 0 ? '+' : ''}${diff} kg`);
  }
  if (actual.reps !== ref.set.reps) {
    const diff = actual.reps - ref.set.reps;
    parts.push(`${diff > 0 ? '+' : ''}${diff} rep${Math.abs(diff) === 1 ? '' : 's'}`);
  }
  if (!parts.length) return null;
  return `${parts.join(' · ')} vs plan`;
}

export function plannedOnlyExercises(plan: GymPlan | null, actual: { exercises: ActualExercise[] }): PlannedExercise[] {
  if (!plan) return [];
  const performedIds = new Set(actual.exercises.filter((exercise) => !exercise.user_added).map((exercise) => exercise.client_id));
  const performedNames = new Set(actual.exercises.filter((exercise) => !exercise.user_added).map((exercise) => normalizedName(exercise.name)));
  return plan.exercises.filter((exercise) => !performedIds.has(exercise.client_id) && !performedNames.has(normalizedName(exercise.name)));
}
