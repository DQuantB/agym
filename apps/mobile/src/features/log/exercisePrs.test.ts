import { expect, it } from 'vitest';

import { computeExercisePrs } from './exercisePrs';
import type { ConfirmedWorkout } from './confirmedWorkout';

function workout(overrides: Partial<ConfirmedWorkout> & { exercises: ConfirmedWorkout['actual']['exercises'] }): ConfirmedWorkout {
  const { exercises, ...rest } = overrides;
  return {
    id: 'w1', executionId: null, sourceRawLogId: null, planId: null,
    confirmedAt: '2026-08-01T18:00:00Z', scheduledFor: '2026-08-01', planTitle: 'Session', notes: '',
    planned: null, actual: { kind: 'gym_workout_execution', schema_version: 1, exercises }, startedAt: null, completedAt: null,
    ...rest,
  };
}

function set(reps: number, weightKg: number | null, completed = true) {
  return { reps, weight_kg: weightKg, rest_seconds: 120, completed, skipped_reason: null, user_added: false };
}

it('picks the set with the highest estimated one-rep max as the PR for a weighted exercise', () => {
  const workouts = [
    workout({ id: 'w1', scheduledFor: '2026-07-01', exercises: [{ client_id: 'bench', name: 'Bench press', user_added: false, sets: [set(10, 60)] }] }),
    workout({ id: 'w2', scheduledFor: '2026-07-15', exercises: [{ client_id: 'bench', name: 'Bench press', user_added: false, sets: [set(3, 85)] }] }),
  ];
  const prs = computeExercisePrs(workouts);
  expect(prs).toEqual([{ exerciseName: 'Bench press', weightKg: 85, reps: 3, estimatedOneRepMaxKg: 93.5, achievedOn: '2026-07-15' }]);
});

it('ignores incomplete sets and sets with zero or negative reps', () => {
  const workouts = [workout({ exercises: [{ client_id: 'bench', name: 'Bench press', user_added: false, sets: [set(10, 100, false), set(0, 100)] }] })];
  expect(computeExercisePrs(workouts)).toEqual([]);
});

it('ranks a bodyweight-only exercise by reps', () => {
  const workouts = [
    workout({ id: 'w1', scheduledFor: '2026-07-01', exercises: [{ client_id: 'pullup', name: 'Pull-up', user_added: false, sets: [set(8, null)] }] }),
    workout({ id: 'w2', scheduledFor: '2026-07-10', exercises: [{ client_id: 'pullup', name: 'Pull-up', user_added: false, sets: [set(12, null)] }] }),
  ];
  expect(computeExercisePrs(workouts)).toEqual([{ exerciseName: 'Pull-up', weightKg: null, reps: 12, estimatedOneRepMaxKg: null, achievedOn: '2026-07-10' }]);
});

it('prefers a weighted record over an earlier bodyweight record for the same exercise', () => {
  const workouts = [
    workout({ id: 'w1', scheduledFor: '2026-07-01', exercises: [{ client_id: 'dip', name: 'Dip', user_added: false, sets: [set(15, null)] }] }),
    workout({ id: 'w2', scheduledFor: '2026-07-10', exercises: [{ client_id: 'dip', name: 'Dip', user_added: false, sets: [set(5, 20)] }] }),
  ];
  const prs = computeExercisePrs(workouts);
  expect(prs).toEqual([{ exerciseName: 'Dip', weightKg: 20, reps: 5, estimatedOneRepMaxKg: 23.3, achievedOn: '2026-07-10' }]);
});

it('tracks separate PRs per exercise, sorted by name', () => {
  const workouts = [workout({ exercises: [
    { client_id: 'squat', name: 'Squat', user_added: false, sets: [set(5, 100)] },
    { client_id: 'bench', name: 'Bench press', user_added: false, sets: [set(5, 80)] },
  ] })];
  expect(computeExercisePrs(workouts).map((pr) => pr.exerciseName)).toEqual(['Bench press', 'Squat']);
});

it('returns no PRs for an empty history', () => {
  expect(computeExercisePrs([])).toEqual([]);
});
