import { describe, expect, it } from 'vitest';
import { executionFromPlan, gymWorkoutPlanSchema, todayLocalDate } from './gymSchemas';

describe('Gym workout contract', () => {
  const plan = { kind: 'gym_workout', schema_version: 1, scheduled_for: '2026-07-14', title: 'Lower', exercises: [{ client_id: 'squat', name: 'Squat', sets: [{ reps: 5, weight_kg: 60, rest_seconds: 180 }] }] } as const;
  it('accepts a formatted workout and creates an editable execution baseline', () => {
    const parsed = gymWorkoutPlanSchema.parse(plan);
    expect(executionFromPlan(parsed).exercises[0].sets[0]).toMatchObject({ reps: 5, weight_kg: 60, completed: false, user_added: false });
  });
  it('rejects malformed Gym plans', () => {
    expect(() => gymWorkoutPlanSchema.parse({ ...plan, exercises: [] })).toThrow();
    expect(() => gymWorkoutPlanSchema.parse({ ...plan, scheduled_for: 'tomorrow' })).toThrow();
  });
  it('uses browser-local calendar dates', () => {
    expect(todayLocalDate(new Date('2026-07-14T10:00:00.000Z'))).toMatch(/^2026-07-14$/);
  });
});
