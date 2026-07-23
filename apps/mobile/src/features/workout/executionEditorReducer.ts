import type { ActualData } from './workoutApi';

export type ExecutionEditorState = { actualData: ActualData; additionalNotes: string };
export type ExecutionEditorAction =
  | { type: 'hydrate'; state: ExecutionEditorState }
  | { type: 'set_weight'; exerciseIndex: number; setIndex: number; weightKg: number | null }
  | { type: 'set_reps'; exerciseIndex: number; setIndex: number; reps: number }
  | { type: 'toggle_set'; exerciseIndex: number; setIndex: number }
  | { type: 'skip_set'; exerciseIndex: number; setIndex: number; reason: string }
  | { type: 'add_set'; exerciseIndex: number }
  | { type: 'add_exercise' }
  | { type: 'add_catalogue_exercise'; name: string; catalogueExerciseId: string }
  | { type: 'set_exercise_name'; exerciseIndex: number; name: string }
  | { type: 'set_notes'; notes: string };

export function executionEditorReducer(state: ExecutionEditorState, action: ExecutionEditorAction): ExecutionEditorState {
  if (action.type === 'hydrate') return action.state;
  if (action.type === 'set_notes') return { ...state, additionalNotes: action.notes };

  const exercises = structuredClone(state.actualData.exercises);
  if (action.type === 'add_exercise') {
    exercises.push({
      client_id: `user-added-${Date.now()}`,
      name: 'New exercise',
      user_added: true,
      sets: [{ reps: 1, weight_kg: null, rest_seconds: 120, completed: false, skipped_reason: null, user_added: true }],
    });
    return { ...state, actualData: { ...state.actualData, exercises } };
  }
  if (action.type === 'add_catalogue_exercise') {
    exercises.push({
      client_id: `user-added-${Date.now()}`,
      name: action.name,
      catalogue_exercise_id: action.catalogueExerciseId,
      user_added: true,
      sets: [{ reps: 1, weight_kg: null, rest_seconds: 120, completed: false, skipped_reason: null, user_added: true }],
    });
    return { ...state, actualData: { ...state.actualData, exercises } };
  }

  const exercise = exercises[action.exerciseIndex];
  if (!exercise) return state;
  if (action.type === 'set_exercise_name') {
    const name = action.name.trim();
    exercise.name = name || 'New exercise';
    return { ...state, actualData: { ...state.actualData, exercises } };
  }

  if (action.type === 'add_set') {
    exercise.sets.push({ reps: 1, weight_kg: null, rest_seconds: 120, completed: false, skipped_reason: null, user_added: true });
  } else {
    const set = exercise.sets[action.setIndex];
    if (!set) return state;
    if (action.type === 'set_weight') set.weight_kg = action.weightKg;
    if (action.type === 'set_reps') set.reps = Math.max(1, action.reps || 1);
    if (action.type === 'toggle_set') {
      set.completed = !set.completed;
      set.skipped_reason = null;
    }
    if (action.type === 'skip_set') {
      set.completed = false;
      set.skipped_reason = action.reason.trim();
    }
  }
  return { ...state, actualData: { ...state.actualData, exercises } };
}
