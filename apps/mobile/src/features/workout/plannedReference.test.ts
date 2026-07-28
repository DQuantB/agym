import { expect, it } from 'vitest';

import {
  findPlannedExercise, findPlannedSet, formatKg, formatPlannedDelta, formatPlannedSetLabel, plannedOnlyExercises,
} from './plannedReference';
import type { ActualData, GymPlan } from './workoutApi';

const plan: GymPlan = {
  kind: 'gym_workout', schema_version: 1, scheduled_for: '2026-07-28', title: 'Upper strength',
  exercises: [
    { client_id: 'bench', name: 'Bench press', sets: [{ reps: 5, weight_kg: 80, rest_seconds: 120 }, { reps: 5, weight_kg: 80, rest_seconds: 120 }] },
    { client_id: 'dips', name: 'Dips', sets: [{ reps: 8, weight_kg: null, rest_seconds: 90 }] },
    { client_id: 'row-dup', name: 'Row', sets: [{ reps: 10, weight_kg: 60, rest_seconds: 90 }] },
    { client_id: 'row-dup-2', name: 'Row', sets: [{ reps: 10, weight_kg: 60, rest_seconds: 90 }] },
  ],
};

function actualExercise(overrides: Partial<ActualData['exercises'][number]>): ActualData['exercises'][number] {
  return { client_id: 'bench', name: 'Bench press', user_added: false, sets: [], ...overrides };
}

it('matches an actual exercise to its plan by client_id', () => {
  const found = findPlannedExercise(plan, actualExercise({}));
  expect(found?.client_id).toBe('bench');
});

it('falls back to normalized name when client_id has drifted', () => {
  const found = findPlannedExercise(plan, actualExercise({ client_id: 'renamed-bench', name: '  Bench Press  ' }));
  expect(found?.client_id).toBe('bench');
});

it('never matches a user_added exercise back into the plan', () => {
  expect(findPlannedExercise(plan, actualExercise({ user_added: true }))).toBeNull();
  expect(findPlannedSet(plan, actualExercise({ user_added: true }), 0)).toEqual({ kind: 'added_exercise' });
});

it('returns unmatched when there is no plan', () => {
  expect(findPlannedSet(null, actualExercise({}), 0)).toEqual({ kind: 'unmatched' });
});

it('returns the planned set for an in-range index', () => {
  const ref = findPlannedSet(plan, actualExercise({}), 0);
  expect(ref).toMatchObject({ kind: 'planned', plannedSetCount: 2 });
});

it('flags a set beyond the planned count as an extra set', () => {
  const ref = findPlannedSet(plan, actualExercise({}), 2);
  expect(ref).toEqual({ kind: 'extra_set', exerciseName: 'Bench press', plannedSetCount: 2 });
});

it('matches the first duplicate client_id deterministically', () => {
  const ref = findPlannedSet(plan, actualExercise({ client_id: 'row-dup', name: 'Row' }), 0);
  expect(ref).toMatchObject({ kind: 'planned', exerciseName: 'Row' });
});

it('treats undefined and null weight_kg as equally bodyweight for delta purposes', () => {
  const ref = findPlannedSet(plan, actualExercise({ client_id: 'dips', name: 'Dips' }), 0);
  expect(formatPlannedDelta(ref, { reps: 8, weight_kg: undefined })).toBeNull();
  expect(formatPlannedDelta(ref, { reps: 8, weight_kg: null })).toBeNull();
});

it('formats a label for each planned-set-ref kind', () => {
  expect(formatPlannedSetLabel(findPlannedSet(plan, actualExercise({}), 0))).toBe('◇ Planned · 80 kg × 5 · rest 120s');
  expect(formatPlannedSetLabel(findPlannedSet(plan, actualExercise({ client_id: 'dips', name: 'Dips' }), 0))).toBe('◇ Planned · bodyweight × 8 · rest 90s');
  expect(formatPlannedSetLabel(findPlannedSet(plan, actualExercise({}), 2))).toBe('+ Extra set · not in the agent plan (2 planned)');
  expect(formatPlannedSetLabel({ kind: 'added_exercise' })).toBe('+ Added exercise · not in the agent plan');
  expect(formatPlannedSetLabel({ kind: 'unmatched' })).toBe('◇ Planned reference unavailable');
});

it('reports a weight and rep delta only when something actually changed', () => {
  const ref = findPlannedSet(plan, actualExercise({}), 0);
  expect(formatPlannedDelta(ref, { reps: 5, weight_kg: 80 })).toBeNull();
  expect(formatPlannedDelta(ref, { reps: 4, weight_kg: 82.5 })).toBe('+2.5 kg · -1 rep vs plan');
});

it('returns no delta for a non-planned ref', () => {
  expect(formatPlannedDelta({ kind: 'unmatched' }, { reps: 5, weight_kg: 80 })).toBeNull();
});

it('formats missing weight as an em dash', () => {
  expect(formatKg(null)).toBe('—');
  expect(formatKg(undefined)).toBe('—');
  expect(formatKg(82.5)).toBe('82.5');
});

it('lists planned exercises with no performed counterpart, matching by id or name', () => {
  const actual: ActualData = {
    kind: 'gym_workout_execution', schema_version: 1,
    exercises: [actualExercise({})],
  };
  const remaining = plannedOnlyExercises(plan, actual);
  expect(remaining.map((exercise) => exercise.client_id)).toEqual(['dips', 'row-dup', 'row-dup-2']);
});

it('returns an empty list when there is no plan', () => {
  expect(plannedOnlyExercises(null, { exercises: [] })).toEqual([]);
});
