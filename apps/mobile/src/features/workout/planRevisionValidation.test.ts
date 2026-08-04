import { describe, expect, it } from 'vitest';

import { validatePlanRevision } from './planRevisionValidation';
import type { GymPlan } from './workoutApi';

function plan(overrides: Partial<GymPlan> = {}): GymPlan {
  return {
    kind: 'gym_workout', schema_version: 1, scheduled_for: '2026-08-15', title: 'Push day',
    exercises: [
      { client_id: 'bench', name: 'Bench press', sets: [{ reps: 5, weight_kg: 80, rest_seconds: 120 }] },
    ],
    ...overrides,
  };
}

describe('validatePlanRevision', () => {
  it('accepts a valid plan with no issues', () => {
    expect(validatePlanRevision(plan())).toEqual([]);
  });

  it('rejects an empty or whitespace-only title', () => {
    expect(validatePlanRevision(plan({ title: '' }))).toContainEqual({ path: 'title', message: expect.any(String) });
    expect(validatePlanRevision(plan({ title: '   ' }))).toContainEqual({ path: 'title', message: expect.any(String) });
  });

  it('rejects a plan with no exercises', () => {
    expect(validatePlanRevision(plan({ exercises: [] }))).toContainEqual({ path: 'exercises', message: expect.any(String) });
  });

  it('rejects an exercise with an empty name, flagging the exact exercise by index', () => {
    const issues = validatePlanRevision(plan({
      exercises: [
        { client_id: 'a', name: 'Squat', sets: [{ reps: 5, weight_kg: 100, rest_seconds: 120 }] },
        { client_id: 'b', name: '  ', sets: [{ reps: 5, weight_kg: 100, rest_seconds: 120 }] },
      ],
    }));
    expect(issues).toContainEqual({ path: 'exercises[1].name', message: expect.any(String) });
    expect(issues.some((issue) => issue.path === 'exercises[0].name')).toBe(false);
  });

  it('rejects an exercise with zero sets', () => {
    const issues = validatePlanRevision(plan({ exercises: [{ client_id: 'a', name: 'Squat', sets: [] }] }));
    expect(issues).toContainEqual({ path: 'exercises[0].sets', message: expect.any(String) });
  });

  it('rejects non-positive or fractional reps', () => {
    const issues = validatePlanRevision(plan({
      exercises: [{ client_id: 'a', name: 'Squat', sets: [{ reps: 0, weight_kg: null, rest_seconds: 60 }, { reps: 5.5, weight_kg: null, rest_seconds: 60 }] }],
    }));
    expect(issues).toContainEqual({ path: 'exercises[0].sets[0].reps', message: expect.any(String) });
    expect(issues).toContainEqual({ path: 'exercises[0].sets[1].reps', message: expect.any(String) });
  });

  it('accepts a null weight (bodyweight) but rejects a negative one', () => {
    expect(validatePlanRevision(plan({
      exercises: [{ client_id: 'a', name: 'Push-up', sets: [{ reps: 12, weight_kg: null, rest_seconds: 60 }] }],
    }))).toEqual([]);
    const issues = validatePlanRevision(plan({
      exercises: [{ client_id: 'a', name: 'Push-up', sets: [{ reps: 12, weight_kg: -5, rest_seconds: 60 }] }],
    }));
    expect(issues).toContainEqual({ path: 'exercises[0].sets[0].weight_kg', message: expect.any(String) });
  });

  it('rejects a negative or fractional rest', () => {
    const issues = validatePlanRevision(plan({
      exercises: [{ client_id: 'a', name: 'Squat', sets: [{ reps: 5, weight_kg: 100, rest_seconds: -1 }] }],
    }));
    expect(issues).toContainEqual({ path: 'exercises[0].sets[0].rest_seconds', message: expect.any(String) });
  });

  it('reports every issue in one pass rather than stopping at the first', () => {
    const issues = validatePlanRevision(plan({
      title: '',
      exercises: [{ client_id: 'a', name: '', sets: [{ reps: 0, weight_kg: -1, rest_seconds: -1 }] }],
    }));
    expect(issues.length).toBe(5);
  });

  it('accepts an exercise with valid alternatives', () => {
    const issues = validatePlanRevision(plan({
      exercises: [{
        client_id: 'a', name: 'Barbell row', sets: [{ reps: 8, weight_kg: 60, rest_seconds: 90 }],
        alternatives: [{ client_id: 'b', name: 'Lat pulldown' }],
      }],
    }));
    expect(issues).toEqual([]);
  });

  it('rejects an alternative with a blank name, flagging it by index', () => {
    const issues = validatePlanRevision(plan({
      exercises: [{
        client_id: 'a', name: 'Barbell row', sets: [{ reps: 8, weight_kg: 60, rest_seconds: 90 }],
        alternatives: [{ client_id: 'b', name: 'Lat pulldown' }, { client_id: 'c', name: '  ' }],
      }],
    }));
    expect(issues).toContainEqual({ path: 'exercises[0].alternatives[1].name', message: expect.any(String) });
    expect(issues.some((issue) => issue.path === 'exercises[0].alternatives[0].name')).toBe(false);
  });

  it('rejects more than 4 alternatives', () => {
    const issues = validatePlanRevision(plan({
      exercises: [{
        client_id: 'a', name: 'Barbell row', sets: [{ reps: 8, weight_kg: 60, rest_seconds: 90 }],
        alternatives: [
          { client_id: 'b', name: 'Option 1' }, { client_id: 'c', name: 'Option 2' },
          { client_id: 'd', name: 'Option 3' }, { client_id: 'e', name: 'Option 4' }, { client_id: 'f', name: 'Option 5' },
        ],
      }],
    }));
    expect(issues).toContainEqual({ path: 'exercises[0].alternatives', message: expect.any(String) });
  });
});
