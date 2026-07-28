import { expect, it } from 'vitest';

import {
  computeWorkoutProgress, durationMinutes, exerciseVolume, formatDuration, formatProgressLabel, formatVolumeKg,
  plannedVolumeKg, sessionVolume, setOutcome,
} from './workoutMetrics';
import type { ActualData, GymPlan } from './workoutApi';

function set(overrides: Partial<ActualData['exercises'][number]['sets'][number]> = {}) {
  return { reps: 5, weight_kg: 80, rest_seconds: 120, completed: false, skipped_reason: null, user_added: false, ...overrides };
}

const actualData: ActualData = {
  kind: 'gym_workout_execution', schema_version: 1,
  exercises: [
    { client_id: 'bench', name: 'Bench press', user_added: false, sets: [set({ completed: true }), set({ completed: true, weight_kg: 82.5 }), set()] },
    { client_id: 'dips', name: 'Dips', user_added: false, sets: [set({ completed: true, weight_kg: null, reps: 8 }), set({ skipped_reason: 'knee sore', weight_kg: null })] },
  ],
};

it('classifies a set as completed, skipped, or pending', () => {
  expect(setOutcome({ completed: true, skipped_reason: null })).toBe('completed');
  expect(setOutcome({ completed: false, skipped_reason: 'sore' })).toBe('skipped');
  expect(setOutcome({ completed: false, skipped_reason: null })).toBe('pending');
});

it('computes whole-workout progress across all exercises', () => {
  const progress = computeWorkoutProgress(actualData);
  expect(progress).toMatchObject({ totalSets: 5, completedSets: 3, skippedSets: 1, pendingSets: 1, totalExercises: 2, currentSetOrdinal: 5 });
});

it('formats a progress label that mentions skipped sets only when present', () => {
  expect(formatProgressLabel(computeWorkoutProgress(actualData))).toBe('Set 5 of 5 · 1 skipped');
  const noSkips: ActualData = { kind: 'gym_workout_execution', schema_version: 1, exercises: [{ client_id: 'a', name: 'A', user_added: false, sets: [set({ completed: true })] }] };
  expect(formatProgressLabel(computeWorkoutProgress(noSkips))).toBe('Set 1 of 1');
});

it('returns zeroed progress for an empty workout', () => {
  const empty: ActualData = { kind: 'gym_workout_execution', schema_version: 1, exercises: [] };
  expect(computeWorkoutProgress(empty)).toMatchObject({ totalSets: 0, currentSetOrdinal: 0, settledRatio: 0 });
});

it('counts only completed sets with a finite positive weight toward volume, tracking bodyweight sets separately', () => {
  const volume = exerciseVolume(actualData.exercises[0]);
  expect(volume).toEqual({ kg: 80 * 5 + 82.5 * 5, countedSets: 2, bodyweightSets: 0 });

  const bodyweightVolume = exerciseVolume(actualData.exercises[1]);
  expect(bodyweightVolume).toEqual({ kg: 0, countedSets: 0, bodyweightSets: 1 });
});

it('sums session volume across exercises without silently dropping bodyweight sets', () => {
  const total = sessionVolume(actualData);
  expect(total.kg).toBe(80 * 5 + 82.5 * 5);
  expect(total.bodyweightSets).toBe(1);
});

it('computes planned volume from a plan', () => {
  const plan: GymPlan = {
    kind: 'gym_workout', schema_version: 1, scheduled_for: '2026-07-28', title: 'Upper',
    exercises: [{ client_id: 'bench', name: 'Bench press', sets: [{ reps: 5, weight_kg: 80, rest_seconds: 120 }, { reps: 5, weight_kg: 80, rest_seconds: 120 }] }],
  };
  expect(plannedVolumeKg(plan)).toBe(800);
});

it('formats volume, using an em dash for zero', () => {
  expect(formatVolumeKg(0)).toBe('—');
  expect(formatVolumeKg(4250.4)).toBe('4250 kg');
});

it('computes duration in whole minutes, returning null for missing or non-positive spans', () => {
  expect(durationMinutes('2026-07-28T18:00:00.000Z', '2026-07-28T18:52:00.000Z')).toBe(52);
  expect(durationMinutes(null, '2026-07-28T18:52:00.000Z')).toBeNull();
  expect(durationMinutes('2026-07-28T18:00:00.000Z', '2026-07-28T18:00:00.000Z')).toBeNull();
});

it('formats duration under and over an hour', () => {
  expect(formatDuration('2026-07-28T18:00:00.000Z', '2026-07-28T18:48:00.000Z')).toBe('48 min');
  expect(formatDuration('2026-07-28T18:00:00.000Z', '2026-07-28T19:04:00.000Z')).toBe('1 h 04 min');
  expect(formatDuration(null, null)).toBeNull();
});
