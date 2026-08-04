import { expect, it } from 'vitest';

import { actualFromPlan, gymPlanSchema, type GymPlan } from './workoutApi';

const plan: GymPlan = {
  kind: 'gym_workout', schema_version: 1, scheduled_for: '2026-08-15', title: 'Pull day',
  exercises: [
    {
      client_id: 'row', name: 'Barbell row',
      alternatives: [{ client_id: 'lat-pulldown', name: 'Lat pulldown' }, { client_id: 'cable-row', name: 'Seated cable row' }],
      sets: [{ reps: 8, weight_kg: 60, rest_seconds: 90 }],
    },
  ],
};

it('round-trips exercise alternatives through gymPlanSchema unchanged', () => {
  const result = gymPlanSchema.safeParse(plan);

  expect(result.success).toBe(true);
  expect(result.success && result.data.exercises[0].alternatives).toEqual([
    { client_id: 'lat-pulldown', name: 'Lat pulldown' },
    { client_id: 'cable-row', name: 'Seated cable row' },
  ]);
});

it('accepts an exercise with no alternatives at all', () => {
  const noAlternatives: GymPlan = { ...plan, exercises: [{ client_id: 'squat', name: 'Squat', sets: [{ reps: 5, weight_kg: 100, rest_seconds: 120 }] }] };

  const result = gymPlanSchema.safeParse(noAlternatives);

  expect(result.success).toBe(true);
  expect(result.success && result.data.exercises[0].alternatives).toBeUndefined();
});

it('carries alternatives from the plan into a fresh execution via actualFromPlan', () => {
  const actual = actualFromPlan(plan);

  expect(actual.exercises[0].alternatives).toEqual(plan.exercises[0].alternatives);
  expect(actual.exercises[0].selected_alternative_id).toBeUndefined();
});
