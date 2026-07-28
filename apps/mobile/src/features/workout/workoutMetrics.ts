import type { ActualData, ActualExercise, ActualSet, GymPlan } from './workoutApi';

export type SetOutcome = 'completed' | 'skipped' | 'pending';

export function setOutcome(set: Pick<ActualSet, 'completed' | 'skipped_reason'>): SetOutcome {
  if (set.completed) return 'completed';
  if (set.skipped_reason) return 'skipped';
  return 'pending';
}

export type WorkoutProgress = {
  totalSets: number;
  completedSets: number;
  skippedSets: number;
  pendingSets: number;
  totalExercises: number;
  finishedExercises: number;
  currentSetOrdinal: number;
  settledRatio: number;
};

export function computeWorkoutProgress(actualData: ActualData): WorkoutProgress {
  const sets = actualData.exercises.flatMap((exercise) => exercise.sets);
  const completedSets = sets.filter((set) => setOutcome(set) === 'completed').length;
  const skippedSets = sets.filter((set) => setOutcome(set) === 'skipped').length;
  const totalSets = sets.length;
  const pendingSets = totalSets - completedSets - skippedSets;
  const finishedExercises = actualData.exercises.filter((exercise) => exercise.sets.every((set) => setOutcome(set) !== 'pending')).length;
  const settled = completedSets + skippedSets;
  return {
    totalSets,
    completedSets,
    skippedSets,
    pendingSets,
    totalExercises: actualData.exercises.length,
    finishedExercises,
    currentSetOrdinal: totalSets === 0 ? 0 : Math.min(settled + 1, totalSets),
    settledRatio: totalSets === 0 ? 0 : settled / totalSets,
  };
}

export function formatProgressLabel(progress: WorkoutProgress): string {
  const base = `Set ${progress.currentSetOrdinal} of ${progress.totalSets}`;
  return progress.skippedSets > 0 ? `${base} · ${progress.skippedSets} skipped` : base;
}

export type VolumeSummary = { kg: number; countedSets: number; bodyweightSets: number };

function isFiniteWeight(weight: number | null | undefined): weight is number {
  return typeof weight === 'number' && Number.isFinite(weight) && weight > 0;
}

export function exerciseVolume(exercise: Pick<ActualExercise, 'sets'>): VolumeSummary {
  let kg = 0;
  let countedSets = 0;
  let bodyweightSets = 0;
  for (const set of exercise.sets) {
    if (setOutcome(set) !== 'completed') continue;
    if (isFiniteWeight(set.weight_kg)) {
      kg += set.weight_kg * set.reps;
      countedSets += 1;
    } else {
      bodyweightSets += 1;
    }
  }
  return { kg, countedSets, bodyweightSets };
}

export function sessionVolume(actualData: ActualData): VolumeSummary {
  return actualData.exercises.reduce<VolumeSummary>((total, exercise) => {
    const part = exerciseVolume(exercise);
    return { kg: total.kg + part.kg, countedSets: total.countedSets + part.countedSets, bodyweightSets: total.bodyweightSets + part.bodyweightSets };
  }, { kg: 0, countedSets: 0, bodyweightSets: 0 });
}

export function plannedVolumeKg(plan: GymPlan): number {
  return plan.exercises.reduce((total, exercise) => total + exercise.sets.reduce((sum, set) => sum + (isFiniteWeight(set.weight_kg) ? set.weight_kg * set.reps : 0), 0), 0);
}

export function formatVolumeKg(kg: number): string {
  return kg > 0 ? `${Math.round(kg)} kg` : '—';
}

export function durationMinutes(startedAt: string | null, endedAt: string | null): number | null {
  if (!startedAt || !endedAt) return null;
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  const minutes = Math.round((end - start) / 60_000);
  return minutes > 0 ? minutes : null;
}

export function formatDuration(startedAt: string | null, endedAt: string | null): string | null {
  const minutes = durationMinutes(startedAt, endedAt);
  if (minutes === null) return null;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours} h ${String(remainder).padStart(2, '0')} min`;
}
