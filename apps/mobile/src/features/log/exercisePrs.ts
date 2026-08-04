import type { ConfirmedWorkout } from './confirmedWorkout';

export type ExercisePr = {
  exerciseName: string;
  weightKg: number | null;
  reps: number;
  estimatedOneRepMaxKg: number | null;
  achievedOn: string;
};

/** Epley formula: a widely used estimate of one-rep max from a lighter, higher-rep set. */
function estimateOneRepMax(weightKg: number, reps: number): number {
  return weightKg * (1 + reps / 30);
}

function isBetter(candidate: { weightKg: number | null; reps: number }, current: ExercisePr): boolean {
  if (candidate.weightKg !== null && current.weightKg !== null) {
    return estimateOneRepMax(candidate.weightKg, candidate.reps) > estimateOneRepMax(current.weightKg, current.reps);
  }
  // A weighted set always beats a bodyweight-only record for the same exercise --
  // it is the more informative signal once it exists.
  if (candidate.weightKg !== null) return true;
  if (current.weightKg !== null) return false;
  return candidate.reps > current.reps;
}

/** Best single-set performance per exercise across confirmed history, ranked by
 * estimated one-rep max when weighted, or by reps alone for bodyweight exercises. */
export function computeExercisePrs(workouts: ConfirmedWorkout[]): ExercisePr[] {
  const byExercise = new Map<string, ExercisePr>();

  for (const workout of workouts) {
    const achievedOn = workout.scheduledFor ?? workout.confirmedAt.slice(0, 10);
    for (const exercise of workout.actual.exercises) {
      for (const set of exercise.sets) {
        if (!set.completed || set.reps <= 0) continue;
        const candidate = { weightKg: set.weight_kg ?? null, reps: set.reps };
        const current = byExercise.get(exercise.name);
        if (!current || isBetter(candidate, current)) {
          byExercise.set(exercise.name, {
            exerciseName: exercise.name,
            weightKg: candidate.weightKg,
            reps: candidate.reps,
            estimatedOneRepMaxKg: candidate.weightKg !== null ? Math.round(estimateOneRepMax(candidate.weightKg, candidate.reps) * 10) / 10 : null,
            achievedOn,
          });
        }
      }
    }
  }

  return [...byExercise.values()].sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));
}
