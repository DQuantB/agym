import { repairFocusedWorkoutSession, resolveWorkoutFocus, type FocusedWorkoutSession } from './focusedWorkoutSession';
import { setOutcome, type SetOutcome } from './workoutMetrics';
import type { ActualData, ActualExercise } from './workoutApi';

export type SetChip = {
  setIndex: number;
  glyph: string;
  outcome: SetOutcome;
  isFocused: boolean;
  canReset: boolean;
  canDelete: boolean;
  accessibilityLabel: string;
};

export type ExerciseRow = {
  exerciseId: string;
  exerciseIndex: number;
  name: string;
  chips: SetChip[];
  isFocused: boolean;
  isFinished: boolean;
  pillGlyph: string;
  pillLabel: string;
  summary: string;
  accessibilityLabel: string;
};

export type SetChipActions = {
  title: string;
  message: string;
  canReset: boolean;
  canDelete: boolean;
  deleteBlocked: string | null;
};

const SET_GLYPH: Record<SetOutcome, string> = { completed: '✓', skipped: '✕', pending: '○' };
const SET_STATE_WORD: Record<SetOutcome, string> = { completed: 'completed', skipped: 'skipped', pending: 'pending' };

function canDeleteSet(exercise: Pick<ActualExercise, 'user_added' | 'sets'>, setIndex: number): boolean {
  const set = exercise.sets[setIndex];
  return Boolean(set?.user_added) && exercise.sets.length > 1;
}

export function buildExerciseBrowser(actualData: ActualData, session: FocusedWorkoutSession): ExerciseRow[] {
  const repaired = repairFocusedWorkoutSession(actualData, session);
  const focus = resolveWorkoutFocus(actualData, repaired);
  const focusedExerciseId = focus.kind === 'workout_done' ? null : focus.exerciseId;

  return repaired.exerciseOrder.map((exerciseId) => {
    const exerciseIndex = actualData.exercises.findIndex((exercise) => exercise.client_id === exerciseId);
    const exercise = actualData.exercises[exerciseIndex];
    const isFocused = exerciseId === focusedExerciseId;
    const focusedSetIndex = isFocused && focus.kind === 'set' ? focus.setIndex : -1;

    const chips: SetChip[] = exercise.sets.map((set, setIndex) => {
      const outcome = setOutcome(set);
      const chipFocused = focusedSetIndex === setIndex;
      return {
        setIndex,
        glyph: chipFocused ? '▶' : SET_GLYPH[outcome],
        outcome,
        isFocused: chipFocused,
        canReset: outcome !== 'pending',
        canDelete: canDeleteSet(exercise, setIndex),
        accessibilityLabel: `${exercise.name} set ${setIndex + 1}, ${chipFocused ? 'current, ' : ''}${SET_STATE_WORD[outcome]}`,
      };
    });

    const settledCount = chips.filter((chip) => chip.outcome !== 'pending').length;
    const isFinished = settledCount === chips.length;
    const pillGlyph = isFinished ? '✓' : isFocused ? '▶' : '○';
    const stateWord = isFinished ? 'done' : isFocused ? 'current' : 'not started';
    const summary = `${settledCount}/${chips.length}`;

    return {
      exerciseId,
      exerciseIndex,
      name: exercise.name,
      chips,
      isFocused,
      isFinished,
      pillGlyph,
      pillLabel: `${pillGlyph} ${exercise.name}`,
      summary,
      accessibilityLabel: `${exercise.name}, ${stateWord}, ${summary} sets`,
    };
  });
}

function formatSetText(set: { reps: number; weight_kg?: number | null }): string {
  return set.weight_kg === null || set.weight_kg === undefined ? `bodyweight × ${set.reps}` : `${set.weight_kg} kg × ${set.reps}`;
}

export function describeSetChipActions(exercise: ActualExercise, setIndex: number): SetChipActions {
  const set = exercise.sets[setIndex];
  const outcome = setOutcome(set);
  const canDelete = canDeleteSet(exercise, setIndex);
  const deleteBlocked = canDelete
    ? null
    : !set.user_added
      ? 'This is a planned set — skip the exercise instead of deleting a planned set.'
      : 'Every exercise needs at least one set.';

  return {
    title: `Set ${setIndex + 1} — ${formatSetText(set)}`,
    message: outcome === 'pending' ? 'Not logged yet.' : `Currently marked ${SET_STATE_WORD[outcome]}.`,
    canReset: outcome !== 'pending',
    canDelete,
    deleteBlocked,
  };
}
