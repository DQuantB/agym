import { expect, it } from 'vitest';

import { historyTotals, summarizeSession, toSessionCard } from './sessionSummary';
import type { ConfirmedWorkout } from './confirmedWorkout';
import type { GymPlan } from '@/features/workout/workoutApi';

const plan: GymPlan = {
  kind: 'gym_workout', schema_version: 1, scheduled_for: '2026-07-21', title: 'Upper strength',
  exercises: [
    { client_id: 'bench', name: 'Bench press', sets: [{ reps: 5, weight_kg: 80, rest_seconds: 120 }, { reps: 5, weight_kg: 80, rest_seconds: 120 }] },
    { client_id: 'dips', name: 'Dips', sets: [{ reps: 8, weight_kg: null, rest_seconds: 90 }] },
    { client_id: 'row', name: 'Row', sets: [{ reps: 10, weight_kg: 60, rest_seconds: 90 }] },
  ],
};

function workout(overrides: Partial<ConfirmedWorkout> = {}): ConfirmedWorkout {
  return {
    id: 'evt-1', executionId: 'exec-1', sourceRawLogId: 'raw-1', planId: 'plan-1',
    confirmedAt: '2026-07-21T18:42:00.000Z', scheduledFor: '2026-07-21', planTitle: 'Upper strength', notes: 'Felt strong.',
    planned: plan,
    actual: {
      kind: 'gym_workout_execution', schema_version: 1,
      exercises: [
        { client_id: 'bench', name: 'Bench press', user_added: false, sets: [
          { reps: 5, weight_kg: 80, rest_seconds: 120, completed: true, skipped_reason: null, user_added: false },
          { reps: 4, weight_kg: 82.5, rest_seconds: 120, completed: true, skipped_reason: null, user_added: false },
        ] },
        { client_id: 'dips', name: 'Dips', user_added: false, sets: [
          { reps: 8, weight_kg: null, rest_seconds: 90, completed: false, skipped_reason: 'shoulder sore', user_added: false },
        ] },
      ],
    },
    startedAt: '2026-07-21T18:00:00.000Z', completedAt: '2026-07-21T18:52:00.000Z',
    ...overrides,
  };
}

it('builds a session card headline with real duration, volume, and set counts', () => {
  const card = toSessionCard(workout());
  expect(card.dateLabel).toBe('Tue 21 Jul');
  expect(card.durationLabel).toBe('52 min');
  expect(card.headline).toBe('2 exercises · 2 of 3 sets · 730 kg');
  expect(card.deltaLabel).toBe('◇ vs plan: 1 set skipped · 1 exercise not performed');
  expect(card.skippedCount).toBe(1);
});

it('omits the delta line entirely when there is nothing to report', () => {
  const perfect = workout({
    planned: { ...plan, exercises: [plan.exercises[0]] },
    actual: {
      kind: 'gym_workout_execution', schema_version: 1,
      exercises: [{ client_id: 'bench', name: 'Bench press', user_added: false, sets: [
        { reps: 5, weight_kg: 80, rest_seconds: 120, completed: true, skipped_reason: null, user_added: false },
        { reps: 5, weight_kg: 80, rest_seconds: 120, completed: true, skipped_reason: null, user_added: false },
      ] }],
    },
  });
  expect(toSessionCard(perfect).deltaLabel).toBeNull();
});

it('summarizes each exercise with planned-vs-actual set rows and a skipped reason preserved verbatim', () => {
  const summary = summarizeSession(workout());
  const bench = summary.exercises[0];
  expect(bench.plannedSetCount).toBe(2);
  expect(bench.rows[0]).toMatchObject({ plannedLabel: '◇ 80 × 5', actualLabel: '✓ 80 × 5', deltaLabel: null, outcome: 'completed' });
  expect(bench.rows[1]).toMatchObject({ plannedLabel: '◇ 80 × 5', actualLabel: '✓ 82.5 × 4', deltaLabel: '+2.5 kg · -1 rep vs plan', outcome: 'completed' });

  const dips = summary.exercises[1];
  expect(dips.rows[0]).toMatchObject({ plannedLabel: '◇ bodyweight × 8', actualLabel: '✕ Skipped', outcome: 'skipped' });

  expect(summary.skipped).toEqual([{ exercise: 'Dips', setOrdinal: 1, reason: 'shoulder sore' }]);
  expect(summary.notPerformed).toEqual([{ name: 'Row', plannedSetCount: 1 }]);
});

it('flags an extra set and an added exercise distinctly from a planned one', () => {
  const withExtras = workout({
    actual: {
      kind: 'gym_workout_execution', schema_version: 1,
      exercises: [
        { client_id: 'bench', name: 'Bench press', user_added: false, sets: [
          { reps: 5, weight_kg: 80, rest_seconds: 120, completed: true, skipped_reason: null, user_added: false },
          { reps: 5, weight_kg: 80, rest_seconds: 120, completed: true, skipped_reason: null, user_added: false },
          { reps: 5, weight_kg: 80, rest_seconds: 120, completed: true, skipped_reason: null, user_added: true },
        ] },
        { client_id: 'user-added-1', name: 'Curls', user_added: true, sets: [
          { reps: 12, weight_kg: 15, rest_seconds: 60, completed: true, skipped_reason: null, user_added: true },
        ] },
      ],
    },
  });
  const summary = summarizeSession(withExtras);
  expect(summary.exercises[0].rows[2].plannedLabel).toBe('+ extra set');
  expect(summary.exercises[1]).toMatchObject({ userAdded: true, plannedSetCount: null });
  expect(summary.exercises[1].rows[0].plannedLabel).toBe('+ added');
});

it('totals sessions across history without silently dropping bodyweight volume', () => {
  const totals = historyTotals([workout(), workout({ id: 'evt-2', confirmedAt: '2026-07-20T10:00:00.000Z' })]);
  expect(totals).toMatchObject({ sessionCount: 2, totalVolumeKg: 1460, totalSets: 6, lastSessionDate: '2026-07-21T18:42:00.000Z' });
});

it('returns zeroed totals for an empty history', () => {
  expect(historyTotals([])).toEqual({ sessionCount: 0, totalVolumeKg: 0, totalSets: 0, lastSessionDate: null });
});
