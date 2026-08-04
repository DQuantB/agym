import { expect, it } from 'vitest';

import { executionEditorReducer, type ExecutionEditorState } from './executionEditorReducer';

const initial: ExecutionEditorState = {
  actualData: {
    kind: 'gym_workout_execution',
    schema_version: 1,
    exercises: [{ client_id: 'squat', name: 'Squat', user_added: false, sets: [{ reps: 5, weight_kg: 80, rest_seconds: 120, completed: false, skipped_reason: null, user_added: false }] }],
  },
  additionalNotes: '',
};

it('adds a user-owned actual exercise without changing the planned exercise', () => {
  const result = executionEditorReducer(initial, { type: 'add_exercise' } as never);

  expect(result.actualData.exercises).toHaveLength(2);
  expect(result.actualData.exercises[0]).toEqual(initial.actualData.exercises[0]);
  expect(result.actualData.exercises[1]).toMatchObject({ name: 'New exercise', user_added: true, sets: [{ reps: 1, completed: false, user_added: true }] });
});

it('adds a catalogue-selected exercise with its name set immediately and linked to the catalogue id', () => {
  const result = executionEditorReducer(initial, { type: 'add_catalogue_exercise', name: 'Bench press', catalogueExerciseId: '11111111-1111-4111-8111-111111111111' } as never);

  expect(result.actualData.exercises).toHaveLength(2);
  expect(result.actualData.exercises[0]).toEqual(initial.actualData.exercises[0]);
  expect(result.actualData.exercises[1]).toMatchObject({ name: 'Bench press', catalogue_exercise_id: '11111111-1111-4111-8111-111111111111', user_added: true });
});

it('keeps an actual exercise name nonblank when the user clears its input', () => {
  const added = executionEditorReducer(initial, { type: 'add_exercise' } as never);
  const result = executionEditorReducer(added, { type: 'set_exercise_name', exerciseIndex: 1, name: '   ' } as never);

  expect(result.actualData.exercises[1].name).toBe('New exercise');
});

it('starts rest only from a completed set action, not from a skipped set', () => {
  const completed = executionEditorReducer(initial, { type: 'toggle_set', exerciseIndex: 0, setIndex: 0 });
  const skipped = executionEditorReducer(initial, { type: 'skip_set', exerciseIndex: 0, setIndex: 0, reason: 'Equipment unavailable' });

  expect(completed.actualData.exercises[0].sets[0].completed).toBe(true);
  expect(skipped.actualData.exercises[0].sets[0]).toMatchObject({ completed: false, skipped_reason: 'Equipment unavailable' });
});

it('completes a set without allowing a second action to undo it', () => {
  const completed = executionEditorReducer(initial, { type: 'complete_set', exerciseIndex: 0, setIndex: 0 });
  const repeated = executionEditorReducer(completed, { type: 'complete_set', exerciseIndex: 0, setIndex: 0 });

  expect(repeated.actualData.exercises[0].sets[0]).toMatchObject({ completed: true, skipped_reason: null });
});

it('skips every set of an exercise with one action, including one already completed', () => {
  const twoSetState: ExecutionEditorState = {
    actualData: {
      kind: 'gym_workout_execution',
      schema_version: 1,
      exercises: [{ client_id: 'row', name: 'Barbell row', user_added: false, sets: [
        { reps: 8, weight_kg: 40, rest_seconds: 90, completed: false, skipped_reason: null, user_added: false },
        { reps: 8, weight_kg: 40, rest_seconds: 90, completed: true, skipped_reason: null, user_added: false },
      ] }],
    },
    additionalNotes: '',
  };
  const result = executionEditorReducer(twoSetState, { type: 'skip_exercise', exerciseIndex: 0, reason: 'Equipment unavailable' });

  expect(result.actualData.exercises[0].sets).toEqual([
    { reps: 8, weight_kg: 40, rest_seconds: 90, completed: false, skipped_reason: 'Equipment unavailable', user_added: false },
    { reps: 8, weight_kg: 40, rest_seconds: 90, completed: false, skipped_reason: 'Equipment unavailable', user_added: false },
  ]);
});

it('trims the skip_exercise reason, same as skip_set', () => {
  const result = executionEditorReducer(initial, { type: 'skip_exercise', exerciseIndex: 0, reason: '  Sore knee  ' });

  expect(result.actualData.exercises[0].sets[0].skipped_reason).toBe('Sore knee');
});

it('switches to an alternative exercise while preserving the slot client_id', () => {
  const result = executionEditorReducer(initial, {
    type: 'select_exercise_alternative', exerciseIndex: 0, name: 'Front squat', catalogueExerciseId: 'cat-front-squat', selectedAlternativeId: 'front-squat',
  });

  expect(result.actualData.exercises[0]).toMatchObject({ client_id: 'squat', name: 'Front squat', catalogue_exercise_id: 'cat-front-squat', selected_alternative_id: 'front-squat' });
});

it('reverts to the main option by clearing selected_alternative_id', () => {
  const switched = executionEditorReducer(initial, {
    type: 'select_exercise_alternative', exerciseIndex: 0, name: 'Front squat', selectedAlternativeId: 'front-squat',
  });
  const reverted = executionEditorReducer(switched, {
    type: 'select_exercise_alternative', exerciseIndex: 0, name: 'Squat', selectedAlternativeId: null,
  });

  expect(reverted.actualData.exercises[0]).toMatchObject({ client_id: 'squat', name: 'Squat', selected_alternative_id: null });
});
