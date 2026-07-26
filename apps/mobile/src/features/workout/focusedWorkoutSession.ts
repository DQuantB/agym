import type { ActualData } from './workoutApi';

export type FocusedWorkoutSession = {
  exerciseOrder: string[];
  restEndsAt: number | null;
};

export type CurrentWorkoutSet = {
  exerciseId: string;
  exerciseIndex: number;
  setIndex: number;
};

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
  const restEndsAt = typeof saved?.restEndsAt === 'number' && Number.isFinite(saved.restEndsAt)
    ? saved.restEndsAt
    : null;

  return { exerciseOrder, restEndsAt };
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
