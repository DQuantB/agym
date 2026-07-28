import { gymPlanSchema, type ActualData, type ActualExercise, type ActualSet, type GymPlan } from '@/features/workout/workoutApi';

export type ConfirmedWorkout = {
  id: string;
  executionId: string | null;
  sourceRawLogId: string | null;
  planId: string | null;
  confirmedAt: string;
  scheduledFor: string | null;
  planTitle: string;
  notes: string;
  planned: GymPlan | null;
  actual: ActualData;
  startedAt: string | null;
  completedAt: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function normalizeSet(value: unknown): ActualSet | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const reps = typeof raw.reps === 'number' && Number.isFinite(raw.reps) ? raw.reps : 0;
  const weight_kg = typeof raw.weight_kg === 'number' && Number.isFinite(raw.weight_kg) ? raw.weight_kg : null;
  const rest_seconds = typeof raw.rest_seconds === 'number' && Number.isFinite(raw.rest_seconds) ? raw.rest_seconds : 120;
  const completed = raw.completed === true;
  const skipped_reason = typeof raw.skipped_reason === 'string' && raw.skipped_reason.trim() ? raw.skipped_reason : null;
  const user_added = raw.user_added === true;
  return { reps, weight_kg, rest_seconds, completed, skipped_reason, user_added };
}

function normalizeExercise(value: unknown): ActualExercise | null {
  const raw = asRecord(value);
  if (!raw || typeof raw.name !== 'string' || !Array.isArray(raw.sets)) return null;
  const sets = raw.sets.map(normalizeSet).filter((set): set is ActualSet => set !== null);
  if (!sets.length) return null;
  return {
    client_id: typeof raw.client_id === 'string' ? raw.client_id : raw.name,
    name: raw.name,
    catalogue_exercise_id: typeof raw.catalogue_exercise_id === 'string' ? raw.catalogue_exercise_id : undefined,
    user_added: raw.user_added === true,
    sets,
  };
}

function normalizeActualData(value: unknown): ActualData {
  const raw = asRecord(value);
  const exercises = Array.isArray(raw?.exercises)
    ? raw.exercises.map(normalizeExercise).filter((exercise): exercise is ActualExercise => exercise !== null)
    : [];
  return { kind: 'gym_workout_execution', schema_version: 1, exercises };
}

export function parseConfirmedWorkout(row: {
  id: string;
  confirmed_at: string;
  final_fields: unknown;
  source_raw_log_id?: string | null;
  plan_id?: string | null;
}): ConfirmedWorkout | null {
  const fields = asRecord(row.final_fields);
  if (!fields) return null;

  const plannedResult = gymPlanSchema.safeParse(fields.planned_snapshot);
  const planned = plannedResult.success ? plannedResult.data : null;
  const actual = normalizeActualData(fields.actual);
  const rawPlanTitle = asRecord(fields.planned_snapshot)?.title;

  return {
    id: row.id,
    executionId: typeof fields.execution_id === 'string' ? fields.execution_id : null,
    sourceRawLogId: row.source_raw_log_id ?? null,
    planId: row.plan_id ?? null,
    confirmedAt: row.confirmed_at,
    scheduledFor: typeof fields.scheduled_for === 'string' ? fields.scheduled_for : null,
    planTitle: planned?.title ?? (typeof rawPlanTitle === 'string' ? rawPlanTitle : 'Gym workout'),
    notes: typeof fields.additional_notes === 'string' ? fields.additional_notes : '',
    planned,
    actual,
    startedAt: null,
    completedAt: null,
  };
}
