import type { ActualData } from './workoutApi';

export type FocusedWorkoutSession = {
  exerciseOrder: string[];
  focusedExerciseId: string | null;
  restEndsAt: number | null;
};

export type CurrentWorkoutSet = {
  exerciseId: string;
  exerciseIndex: number;
  setIndex: number;
};

export type WorkoutFocus =
  | { kind: 'set'; exerciseId: string; exerciseIndex: number; setIndex: number; isManual: boolean }
  | { kind: 'exercise_done'; exerciseId: string; exerciseIndex: number }
  | { kind: 'workout_done' };

function isUnfinishedExercise(actualData: ActualData, exerciseId: string): boolean {
  const exercise = actualData.exercises.find((candidate) => candidate.client_id === exerciseId);
  return Boolean(exercise?.sets.some((set) => !set.completed && !set.skipped_reason));
}

export function repairFocusedWorkoutSession(
  actualData: ActualData,
  saved?: Partial<FocusedWorkoutSession> | null,
): FocusedWorkoutSession {
  const knownIds = new Set(actualData.exercises.map((exercise) => exercise.client_id));
  const savedOrder = saved?.exerciseOrder ?? [];
  const exerciseOrder = [
    ...savedOrder.filter((id, index) => knownIds.has(id) && savedOrder.indexOf(id) === index),
    ...actualData.exercises.map((exercise) => exercise.client_id).filter((id) => !savedOrder.includes(id)),
  ];
  const focusedExerciseId = typeof saved?.focusedExerciseId === 'string' && knownIds.has(saved.focusedExerciseId)
    ? saved.focusedExerciseId
    : null;
  const restEndsAt = typeof saved?.restEndsAt === 'number' && Number.isFinite(saved.restEndsAt)
    ? saved.restEndsAt
    : null;

  return { exerciseOrder, focusedExerciseId, restEndsAt };
}

export function getCurrentWorkoutSet(
  actualData: ActualData,
  session: FocusedWorkoutSession,
): CurrentWorkoutSet | null {
  const repaired = repairFocusedWorkoutSession(actualData, session);
  for (const exerciseId of repaired.exerciseOrder) {
    const exerciseIndex = actualData.exercises.findIndex((exercise) => exercise.client_id === exerciseId);
    const exercise = actualData.exercises[exerciseIndex];
    if (!exercise) continue;
    const setIndex = exercise.sets.findIndex((set) => !set.completed && !set.skipped_reason);
    if (setIndex >= 0) return { exerciseId, exerciseIndex, setIndex };
  }
  return null;
}

export function canDeferCurrentExercise(actualData: ActualData, session: FocusedWorkoutSession): boolean {
  const repaired = repairFocusedWorkoutSession(actualData, session);
  const current = getCurrentWorkoutSet(actualData, repaired);
  if (!current) return false;
  const unfinishedIds = repaired.exerciseOrder.filter((exerciseId) => isUnfinishedExercise(actualData, exerciseId));
  return unfinishedIds.indexOf(current.exerciseId) !== unfinishedIds.length - 1;
}

export function deferCurrentExercise(
  actualData: ActualData,
  session: FocusedWorkoutSession,
): FocusedWorkoutSession {
  const repaired = repairFocusedWorkoutSession(actualData, session);
  const current = getCurrentWorkoutSet(actualData, repaired);
  if (!current) return repaired;

  const unfinishedIds = repaired.exerciseOrder.filter((exerciseId) => isUnfinishedExercise(actualData, exerciseId));
  if (unfinishedIds.indexOf(current.exerciseId) === unfinishedIds.length - 1) return repaired;

  return {
    ...repaired,
    exerciseOrder: [...repaired.exerciseOrder.filter((id) => id !== current.exerciseId), current.exerciseId],
  };
}

export function setRestEnd(
  session: FocusedWorkoutSession,
  restEndsAt: number | null,
): FocusedWorkoutSession {
  return { ...session, restEndsAt };
}

export function resolveWorkoutFocus(actualData: ActualData, session: FocusedWorkoutSession): WorkoutFocus {
  const repaired = repairFocusedWorkoutSession(actualData, session);
  const auto = getCurrentWorkoutSet(actualData, repaired);

  if (!repaired.focusedExerciseId) {
    return auto ? { kind: 'set', ...auto, isManual: false } : { kind: 'workout_done' };
  }

  const exerciseIndex = actualData.exercises.findIndex((exercise) => exercise.client_id === repaired.focusedExerciseId);
  const exercise = actualData.exercises[exerciseIndex];
  if (!exercise) return auto ? { kind: 'set', ...auto, isManual: false } : { kind: 'workout_done' };

  const setIndex = exercise.sets.findIndex((set) => !set.completed && !set.skipped_reason);
  if (setIndex < 0) return { kind: 'exercise_done', exerciseId: exercise.client_id, exerciseIndex };

  const isManual = exercise.client_id !== auto?.exerciseId;
  return { kind: 'set', exerciseId: exercise.client_id, exerciseIndex, setIndex, isManual };
}

export function focusExercise(session: FocusedWorkoutSession, exerciseId: string): FocusedWorkoutSession {
  return { ...session, focusedExerciseId: exerciseId };
}

export function clearWorkoutFocus(session: FocusedWorkoutSession): FocusedWorkoutSession {
  if (!session.focusedExerciseId) return session;
  return { ...session, focusedExerciseId: null };
}

/**
 * Called with the pre-action actualData (same convention as deferCurrentExercise):
 * releases the manual override once the set that just settled was the focused
 * exercise's last pending one, so completing/skipping a forgotten set drops the
 * user back onto the auto-advance queue instead of stranding them.
 */
export function releaseFocusAfterSet(
  actualData: ActualData,
  session: FocusedWorkoutSession,
  setIndex: number,
): FocusedWorkoutSession {
  if (!session.focusedExerciseId) return session;
  const exercise = actualData.exercises.find((candidate) => candidate.client_id === session.focusedExerciseId);
  if (!exercise) return session;
  const otherPending = exercise.sets.some((set, index) => index !== setIndex && !set.completed && !set.skipped_reason);
  if (otherPending) return session;
  return { ...session, focusedExerciseId: null };
}
