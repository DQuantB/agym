import { expect, it } from 'vitest';

import { canDeferCurrentExercise, deferCurrentExercise, getCurrentWorkoutSet, repairFocusedWorkoutSession, setRestEnd } from './focusedWorkoutSession';
import type { ActualData } from './workoutApi';

const actualData: ActualData = {
  kind: 'gym_workout_execution',
  schema_version: 1,
  exercises: [
    {
      client_id: 'bench', name: 'Bench press', user_added: false,
      sets: [
        { reps: 8, weight_kg: 80, rest_seconds: 120, completed: false, skipped_reason: null, user_added: false },
        { reps: 8, weight_kg: 80, rest_seconds: 120, completed: false, skipped_reason: null, user_added: false },
      ],
    },
    {
      client_id: 'row', name: 'Row', user_added: false,
      sets: [{ reps: 10, weight_kg: 60, rest_seconds: 90, completed: false, skipped_reason: null, user_added: false }],
    },
    {
      client_id: 'press', name: 'Shoulder press', user_added: false,
      sets: [{ reps: 10, weight_kg: 20, rest_seconds: 90, completed: false, skipped_reason: null, user_added: false }],
    },
  ],
};

it('repairs a saved queue, removes stale or duplicate ids, and appends new exercises', () => {
  expect(repairFocusedWorkoutSession(actualData, { exerciseOrder: ['row', 'missing', 'row'], restEndsAt: 5000 }))
    .toEqual({ exerciseOrder: ['row', 'bench', 'press'], restEndsAt: 5000 });
});

it('finds the first actionable set and ignores completed or skipped sets', () => {
  const changed = structuredClone(actualData);
  changed.exercises[0].sets[0].completed = true;
  changed.exercises[0].sets[1].skipped_reason = 'Bench unavailable';

  expect(getCurrentWorkoutSet(changed, repairFocusedWorkoutSession(changed))).toEqual({
    exerciseId: 'row', exerciseIndex: 1, setIndex: 0,
  });
});

it('restores a saved queue and absolute rest timestamp after JSON draft persistence', () => {
  const savedDraftSession = JSON.parse(JSON.stringify({
    exerciseOrder: ['press', 'bench', 'row'],
    restEndsAt: 1_725_000_000_000,
  }));

  expect(repairFocusedWorkoutSession(actualData, savedDraftSession)).toEqual(savedDraftSession);
});

it('defers the whole current exercise while preserving its edited actual values and completed sets', () => {
  const changed = structuredClone(actualData);
  changed.exercises[0].sets[0].completed = true;
  changed.exercises[0].sets[1].weight_kg = 82.5;
  const session = repairFocusedWorkoutSession(changed, { exerciseOrder: ['bench', 'row', 'press'], restEndsAt: null });

  const deferred = deferCurrentExercise(changed, session);

  expect(deferred.exerciseOrder).toEqual(['row', 'press', 'bench']);
  expect(deferred.restEndsAt).toBeNull();
  expect(changed.exercises[0].sets).toMatchObject([{ completed: true }, { weight_kg: 82.5, completed: false }]);
});

it('does not defer when the current exercise is already the last unfinished exercise', () => {
  const changed = structuredClone(actualData);
  changed.exercises[1].sets[0].completed = true;
  changed.exercises[2].sets[0].completed = true;
  const session = repairFocusedWorkoutSession(changed);

  expect(deferCurrentExercise(changed, session)).toEqual(session);
});

it('reports whether the current exercise can be deferred, matching deferCurrentExercise\'s own no-op guard', () => {
  const session = repairFocusedWorkoutSession(actualData, { exerciseOrder: ['bench', 'row', 'press'], restEndsAt: null });
  expect(canDeferCurrentExercise(actualData, session)).toBe(true);

  const changed = structuredClone(actualData);
  changed.exercises[1].sets[0].completed = true;
  changed.exercises[2].sets[0].completed = true;
  expect(canDeferCurrentExercise(changed, repairFocusedWorkoutSession(changed))).toBe(false);
});

it('steps over an exercise once every one of its sets is skipped, and treats it as finished for deferral', () => {
  const changed = structuredClone(actualData);
  changed.exercises[0].sets[0].skipped_reason = 'Equipment unavailable';
  changed.exercises[0].sets[1].skipped_reason = 'Equipment unavailable';
  const session = repairFocusedWorkoutSession(changed);

  expect(getCurrentWorkoutSet(changed, session)).toEqual({ exerciseId: 'row', exerciseIndex: 1, setIndex: 0 });

  changed.exercises[2].sets[0].completed = true;
  expect(canDeferCurrentExercise(changed, repairFocusedWorkoutSession(changed))).toBe(false);
});

it('stores an exact, serializable absolute rest end timestamp', () => {
  const session = setRestEnd(repairFocusedWorkoutSession(actualData), 1_725_000_000_000);

  expect(JSON.parse(JSON.stringify(session))).toEqual({
    exerciseOrder: ['bench', 'row', 'press'], restEndsAt: 1_725_000_000_000,
  });
});
