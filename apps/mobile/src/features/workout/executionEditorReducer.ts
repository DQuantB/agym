import type { ActualData } from './workoutApi';

export type ExecutionEditorState = { actualData: ActualData; additionalNotes: string };
export type ExecutionEditorAction =
  | { type: 'hydrate'; state: ExecutionEditorState }
  | { type: 'set_weight'; exerciseIndex: number; setIndex: number; weightKg: number | null }
  | { type: 'set_reps'; exerciseIndex: number; setIndex: number; reps: number }
  | { type: 'toggle_set'; exerciseIndex: number; setIndex: number }
  | { type: 'complete_set'; exerciseIndex: number; setIndex: number }
  | { type: 'reset_set'; exerciseIndex: number; setIndex: number }
  | { type: 'skip_set'; exerciseIndex: number; setIndex: number; reason: string }
  | { type: 'skip_exercise'; exerciseIndex: number; reason: string }
  | { type: 'add_set'; exerciseIndex: number }
  | { type: 'delete_set'; exerciseIndex: number; setIndex: number }
  | { type: 'add_exercise' }
  | { type: 'add_catalogue_exercise'; name: string; catalogueExerciseId: string }
  | { type: 'set_exercise_name'; exerciseIndex: number; name: string }
  | { type: 'select_exercise_alternative'; exerciseIndex: number; name: string; catalogueExerciseId?: string; selectedAlternativeId: string | null }
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
  if (action.type === 'select_exercise_alternative') {
    exercise.name = action.name;
    exercise.catalogue_exercise_id = action.catalogueExerciseId;
    exercise.selected_alternative_id = action.selectedAlternativeId;
    return { ...state, actualData: { ...state.actualData, exercises } };
  }
  if (action.type === 'skip_exercise') {
    const reason = action.reason.trim();
    for (const set of exercise.sets) {
      set.completed = false;
      set.skipped_reason = reason;
    }
    return { ...state, actualData: { ...state.actualData, exercises } };
  }

  if (action.type === 'add_set') {
    exercise.sets.push({ reps: 1, weight_kg: null, rest_seconds: 120, completed: false, skipped_reason: null, user_added: true });
  } else if (action.type === 'delete_set') {
    const set = exercise.sets[action.setIndex];
    // Only ever deletable if user-added: add_set always pushes, so user-added
    // sets are a tail suffix and deleting one can't shift a planned set's
    // positional index (findPlannedSet in plannedReference.ts is index-based).
    if (!set || !set.user_added || exercise.sets.length <= 1) return state;
    exercise.sets.splice(action.setIndex, 1);
  } else {
    const set = exercise.sets[action.setIndex];
    if (!set) return state;
    if (action.type === 'set_weight') set.weight_kg = action.weightKg;
    if (action.type === 'set_reps') set.reps = Math.max(1, action.reps || 1);
    if (action.type === 'toggle_set') {
      set.completed = !set.completed;
      set.skipped_reason = null;
    }
    if (action.type === 'complete_set') {
      set.completed = true;
      set.skipped_reason = null;
    }
    if (action.type === 'reset_set') {
      set.completed = false;
      set.skipped_reason = null;
    }
    if (action.type === 'skip_set') {
      set.completed = false;
      set.skipped_reason = action.reason.trim();
    }
  }
  return { ...state, actualData: { ...state.actualData, exercises } };
}
