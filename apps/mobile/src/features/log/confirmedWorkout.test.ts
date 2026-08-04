import { expect, it } from 'vitest';

import { parseConfirmedWorkout } from './confirmedWorkout';

function rpcFinalFields(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'workout_execution',
    schema_version: 1,
    scheduled_for: '2026-07-21',
    planned_snapshot: {
      kind: 'gym_workout', schema_version: 1, scheduled_for: '2026-07-21', title: 'Upper strength',
      exercises: [{ client_id: 'bench', name: 'Bench press', sets: [{ reps: 5, weight_kg: 80, rest_seconds: 120 }] }],
    },
    actual: {
      kind: 'gym_workout_execution', schema_version: 1,
      exercises: [{ client_id: 'bench', name: 'Bench press', user_added: false, sets: [{ reps: 4, weight_kg: 82.5, rest_seconds: 120, completed: true, skipped_reason: null, user_added: false }] }],
    },
    additional_notes: 'Felt strong today.',
    execution_id: 'exec-1',
    ...overrides,
  };
}

it('parses a well-formed RPC row into a confirmed workout with exact set fields preserved', () => {
  const parsed = parseConfirmedWorkout({ id: 'evt-1', confirmed_at: '2026-07-21T18:42:00.000Z', final_fields: rpcFinalFields(), source_raw_log_id: 'raw-1', plan_id: 'plan-1' });
  expect(parsed).toMatchObject({
    id: 'evt-1', executionId: 'exec-1', sourceRawLogId: 'raw-1', planId: 'plan-1',
    scheduledFor: '2026-07-21', planTitle: 'Upper strength', notes: 'Felt strong today.',
  });
  expect(parsed?.planned?.title).toBe('Upper strength');
  expect(parsed?.actual.exercises[0].sets[0]).toEqual({ reps: 4, weight_kg: 82.5, rest_seconds: 120, completed: true, skipped_reason: null, user_added: false });
});

it('returns null when final_fields is not an object', () => {
  expect(parseConfirmedWorkout({ id: 'evt-1', confirmed_at: '2026-07-21T18:42:00.000Z', final_fields: null })).toBeNull();
  expect(parseConfirmedWorkout({ id: 'evt-1', confirmed_at: '2026-07-21T18:42:00.000Z', final_fields: 'not an object' })).toBeNull();
});

it('yields planned: null when planned_snapshot fails schema validation, without throwing', () => {
  const parsed = parseConfirmedWorkout({
    id: 'evt-1', confirmed_at: '2026-07-21T18:42:00.000Z',
    final_fields: rpcFinalFields({ planned_snapshot: { kind: 'gym_workout', schema_version: 1, scheduled_for: '2026-07-21', exercises: [] } }),
  });
  expect(parsed?.planned).toBeNull();
});

it('falls back to the raw planned_snapshot title when schema validation fails but a title is present', () => {
  const parsed = parseConfirmedWorkout({
    id: 'evt-1', confirmed_at: '2026-07-21T18:42:00.000Z',
    final_fields: rpcFinalFields({ planned_snapshot: { title: 'Legacy plan', exercises: [] } }),
  });
  expect(parsed?.planned).toBeNull();
  expect(parsed?.planTitle).toBe('Legacy plan');
});

it('falls back to a generic title when neither schema validation nor a raw title succeed', () => {
  const parsed = parseConfirmedWorkout({ id: 'evt-1', confirmed_at: '2026-07-21T18:42:00.000Z', final_fields: rpcFinalFields({ planned_snapshot: null }) });
  expect(parsed?.planTitle).toBe('Gym workout');
});

it('defaults missing set fields on an older or malformed actual payload without throwing', () => {
  const parsed = parseConfirmedWorkout({
    id: 'evt-1', confirmed_at: '2026-07-21T18:42:00.000Z',
    final_fields: rpcFinalFields({
      actual: { kind: 'gym_workout_execution', schema_version: 1, exercises: [{ name: 'Dips', sets: [{ reps: 8 }] }] },
    }),
  });
  expect(parsed?.actual.exercises[0]).toEqual({ client_id: 'Dips', name: 'Dips', user_added: false, sets: [{ reps: 8, weight_kg: null, rest_seconds: 120, completed: false, skipped_reason: null, user_added: false }] });
});

it('drops an exercise with no valid sets rather than surfacing an empty exercise', () => {
  const parsed = parseConfirmedWorkout({
    id: 'evt-1', confirmed_at: '2026-07-21T18:42:00.000Z',
    final_fields: rpcFinalFields({ actual: { kind: 'gym_workout_execution', schema_version: 1, exercises: [{ name: 'Empty', sets: [] }] } }),
  });
  expect(parsed?.actual.exercises).toEqual([]);
});

it('preserves a chosen exercise alternative and its options through normalization', () => {
  const parsed = parseConfirmedWorkout({
    id: 'evt-1', confirmed_at: '2026-07-21T18:42:00.000Z',
    final_fields: rpcFinalFields({
      planned_snapshot: {
        kind: 'gym_workout', schema_version: 1, scheduled_for: '2026-07-21', title: 'Upper strength',
        exercises: [{
          client_id: 'row', name: 'Barbell row', sets: [{ reps: 8, weight_kg: 60, rest_seconds: 90 }],
          alternatives: [{ client_id: 'lat-pulldown', name: 'Lat pulldown' }],
        }],
      },
      actual: {
        kind: 'gym_workout_execution', schema_version: 1,
        exercises: [{
          client_id: 'row', name: 'Lat pulldown', user_added: false, selected_alternative_id: 'lat-pulldown',
          alternatives: [{ client_id: 'lat-pulldown', name: 'Lat pulldown' }],
          sets: [{ reps: 10, weight_kg: 50, rest_seconds: 90, completed: true, skipped_reason: null, user_added: false }],
        }],
      },
    }),
  });
  expect(parsed?.planned?.exercises[0].alternatives).toEqual([{ client_id: 'lat-pulldown', name: 'Lat pulldown' }]);
  expect(parsed?.actual.exercises[0]).toMatchObject({ name: 'Lat pulldown', selected_alternative_id: 'lat-pulldown' });
});

it('leaves startedAt and completedAt null for logApi to merge in from workout_executions', () => {
  const parsed = parseConfirmedWorkout({ id: 'evt-1', confirmed_at: '2026-07-21T18:42:00.000Z', final_fields: rpcFinalFields() });
  expect(parsed?.startedAt).toBeNull();
  expect(parsed?.completedAt).toBeNull();
});
