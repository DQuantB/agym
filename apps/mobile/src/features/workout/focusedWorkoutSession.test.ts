import { expect, it } from 'vitest';

import {
  canDeferCurrentExercise, clearWorkoutFocus, deferCurrentExercise, focusExercise, getCurrentWorkoutSet,
  releaseFocusAfterSet, repairFocusedWorkoutSession, resolveWorkoutFocus, setRestEnd,
} from './focusedWorkoutSession';
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
    .toEqual({ exerciseOrder: ['row', 'bench', 'press'], focusedExerciseId: null, restEndsAt: 5000 });
});

it('keeps a saved focusedExerciseId that still exists in actualData', () => {
  expect(repairFocusedWorkoutSession(actualData, { focusedExerciseId: 'row' }).focusedExerciseId).toBe('row');
});

it('drops a focusedExerciseId for an exercise that no longer exists', () => {
  expect(repairFocusedWorkoutSession(actualData, { focusedExerciseId: 'missing' }).focusedExerciseId).toBeNull();
});

it('drops a corrupt focusedExerciseId value', () => {
  expect(repairFocusedWorkoutSession(actualData, { focusedExerciseId: 42 as never }).focusedExerciseId).toBeNull();
  expect(repairFocusedWorkoutSession(actualData, { focusedExerciseId: {} as never }).focusedExerciseId).toBeNull();
  expect(repairFocusedWorkoutSession(actualData, { focusedExerciseId: '' }).focusedExerciseId).toBeNull();
});

it('defaults focusedExerciseId to null for a pre-feature draft with no such key', () => {
  expect(repairFocusedWorkoutSession(actualData, { exerciseOrder: ['bench', 'row', 'press'], restEndsAt: null }).focusedExerciseId).toBeNull();
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
    focusedExerciseId: null,
    restEndsAt: 1_725_000_000_000,
  }));

  expect(repairFocusedWorkoutSession(actualData, savedDraftSession)).toEqual(savedDraftSession);
});

it('survives JSON persistence with an active manual focus override', () => {
  const savedDraftSession = JSON.parse(JSON.stringify({
    exerciseOrder: ['press', 'bench', 'row'],
    focusedExerciseId: 'bench',
    restEndsAt: null,
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
    exerciseOrder: ['bench', 'row', 'press'], focusedExerciseId: null, restEndsAt: 1_725_000_000_000,
  });
});

it('deferCurrentExercise and setRestEnd preserve focusedExerciseId', () => {
  const session = repairFocusedWorkoutSession(actualData, { exerciseOrder: ['bench', 'row', 'press'], focusedExerciseId: 'row', restEndsAt: null });
  expect(deferCurrentExercise(actualData, session).focusedExerciseId).toBe('row');
  expect(setRestEnd(session, 1000).focusedExerciseId).toBe('row');
});

it('resolveWorkoutFocus with no override matches getCurrentWorkoutSet and reports isManual false', () => {
  const session = repairFocusedWorkoutSession(actualData);
  const focus = resolveWorkoutFocus(actualData, session);
  expect(focus).toEqual({ kind: 'set', exerciseId: 'bench', exerciseIndex: 0, setIndex: 0, isManual: false });
});

it('resolveWorkoutFocus reports isManual true when focused on a deferred exercise that still has a pending set', () => {
  const orderedSession = repairFocusedWorkoutSession(actualData, { exerciseOrder: ['bench', 'press', 'row'] });
  const session = focusExercise(orderedSession, 'row');

  const focus = resolveWorkoutFocus(actualData, session);
  expect(focus).toEqual({ kind: 'set', exerciseId: 'row', exerciseIndex: 1, setIndex: 0, isManual: true });
});

it('resolveWorkoutFocus on a fully completed focused exercise reports exercise_done and does not fall through to the auto set', () => {
  const changed = structuredClone(actualData);
  changed.exercises[0].sets[0].completed = true;
  changed.exercises[0].sets[1].completed = true;
  const session = focusExercise(repairFocusedWorkoutSession(changed), 'bench');

  expect(resolveWorkoutFocus(changed, session)).toEqual({ kind: 'exercise_done', exerciseId: 'bench', exerciseIndex: 0 });
});

it('resolveWorkoutFocus reports isManual false when the override matches the auto-current exercise', () => {
  const session = focusExercise(repairFocusedWorkoutSession(actualData), 'bench');
  const focus = resolveWorkoutFocus(actualData, session);
  expect(focus).toEqual({ kind: 'set', exerciseId: 'bench', exerciseIndex: 0, setIndex: 0, isManual: false });
});

it('resolveWorkoutFocus reports workout_done only with no override and nothing pending', () => {
  const changed = structuredClone(actualData);
  for (const exercise of changed.exercises) for (const set of exercise.sets) set.completed = true;
  expect(resolveWorkoutFocus(changed, repairFocusedWorkoutSession(changed))).toEqual({ kind: 'workout_done' });
});

it('focusExercise with an unknown id is sanitized away by the next repair', () => {
  const session = focusExercise(repairFocusedWorkoutSession(actualData), 'unknown-id');
  const roundTripped = JSON.parse(JSON.stringify(session));
  expect(repairFocusedWorkoutSession(actualData, roundTripped).focusedExerciseId).toBeNull();
});

it('releaseFocusAfterSet clears the override when the settled set was the focused exercise\'s last pending set', () => {
  const session = focusExercise(repairFocusedWorkoutSession(actualData), 'row');
  expect(releaseFocusAfterSet(actualData, session, 0).focusedExerciseId).toBeNull();
});

it('releaseFocusAfterSet keeps the override when another pending set remains in that exercise', () => {
  const session = focusExercise(repairFocusedWorkoutSession(actualData), 'bench');
  expect(releaseFocusAfterSet(actualData, session, 0).focusedExerciseId).toBe('bench');
});

it('releaseFocusAfterSet returns the identical reference when no override is active', () => {
  const session = repairFocusedWorkoutSession(actualData);
  expect(releaseFocusAfterSet(actualData, session, 0)).toBe(session);
});

it('clearWorkoutFocus clears an active override and returns the identical reference otherwise', () => {
  const session = repairFocusedWorkoutSession(actualData);
  expect(clearWorkoutFocus(session)).toBe(session);

  const focused = focusExercise(session, 'row');
  expect(clearWorkoutFocus(focused).focusedExerciseId).toBeNull();
});
