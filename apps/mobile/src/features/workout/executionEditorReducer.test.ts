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
