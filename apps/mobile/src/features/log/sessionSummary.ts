import { formatClockTime, formatWeekdayDate } from '@/lib/dateLabels';
import { findPlannedExercise, findPlannedSet, formatKg, formatPlannedDelta, plannedOnlyExercises, type PlannedSetRef } from '@/features/workout/plannedReference';
import { computeWorkoutProgress, exerciseVolume, formatDuration, formatVolumeKg, sessionVolume, setOutcome, type SetOutcome } from '@/features/workout/workoutMetrics';
import type { ActualExercise, ActualSet } from '@/features/workout/workoutApi';

import type { ConfirmedWorkout } from './confirmedWorkout';

export type SetRow = {
  ordinal: number;
  plannedLabel: string;
  actualLabel: string;
  deltaLabel: string | null;
  skippedReason: string | null;
  outcome: SetOutcome;
};

export type ExerciseSummary = {
  name: string;
  userAdded: boolean;
  substitutedFrom: string | null;
  plannedSetCount: number | null;
  actualSetCount: number;
  skippedCount: number;
  volumeKg: number;
  bodyweightSets: number;
  rows: SetRow[];
};

export type SessionCard = {
  id: string;
  title: string;
  dateLabel: string;
  timeLabel: string;
  durationLabel: string | null;
  headline: string;
  deltaLabel: string | null;
  skippedCount: number;
  accessibilityLabel: string;
};

function compactPlannedLabel(ref: PlannedSetRef): string {
  switch (ref.kind) {
    case 'planned': {
      const weight = ref.set.weight_kg === null || ref.set.weight_kg === undefined ? 'bodyweight' : formatKg(ref.set.weight_kg);
      return `◇ ${weight} × ${ref.set.reps}`;
    }
    case 'extra_set': return '+ extra set';
    case 'added_exercise': return '+ added';
    case 'unmatched': return '—';
  }
}

function actualSetLabel(set: Pick<ActualSet, 'reps' | 'weight_kg' | 'completed' | 'skipped_reason'>): string {
  if (setOutcome(set) === 'skipped') return '✕ Skipped';
  const weight = set.weight_kg === null || set.weight_kg === undefined ? 'bodyweight' : formatKg(set.weight_kg);
  return `✓ ${weight} × ${set.reps}`;
}

function toExerciseSummary(exercise: ActualExercise, w: ConfirmedWorkout): ExerciseSummary {
  const volume = exerciseVolume(exercise);
  const plannedExercise = findPlannedExercise(w.planned, exercise);
  const rows: SetRow[] = exercise.sets.map((set, index) => {
    const ref = findPlannedSet(w.planned, exercise, index);
    return {
      ordinal: index + 1,
      plannedLabel: compactPlannedLabel(ref),
      actualLabel: actualSetLabel(set),
      deltaLabel: formatPlannedDelta(ref, set),
      skippedReason: set.skipped_reason,
      outcome: setOutcome(set),
    };
  });
  return {
    name: exercise.name,
    userAdded: exercise.user_added,
    substitutedFrom: exercise.selected_alternative_id && plannedExercise ? plannedExercise.name : null,
    plannedSetCount: plannedExercise ? plannedExercise.sets.length : null,
    actualSetCount: exercise.sets.length,
    skippedCount: rows.filter((row) => row.outcome === 'skipped').length,
    volumeKg: volume.kg,
    bodyweightSets: volume.bodyweightSets,
    rows,
  };
}

export function toSessionCard(w: ConfirmedWorkout): SessionCard {
  const dateLabel = formatWeekdayDate(w.confirmedAt);
  const timeLabel = formatClockTime(w.confirmedAt);
  const durationLabel = formatDuration(w.startedAt, w.completedAt);
  const volume = sessionVolume(w.actual);
  const progress = computeWorkoutProgress(w.actual);
  const notPerformed = plannedOnlyExercises(w.planned, w.actual);
  const exerciseCount = w.actual.exercises.length;
  const headline = `${exerciseCount} exercise${exerciseCount === 1 ? '' : 's'} · ${progress.completedSets} of ${progress.totalSets} sets · ${formatVolumeKg(volume.kg)}`;

  const deltaParts: string[] = [];
  if (progress.skippedSets > 0) deltaParts.push(`${progress.skippedSets} set${progress.skippedSets === 1 ? '' : 's'} skipped`);
  if (notPerformed.length > 0) deltaParts.push(`${notPerformed.length} exercise${notPerformed.length === 1 ? '' : 's'} not performed`);
  const deltaLabel = deltaParts.length ? `◇ vs plan: ${deltaParts.join(' · ')}` : null;

  return {
    id: w.id,
    title: w.planTitle,
    dateLabel,
    timeLabel,
    durationLabel,
    headline,
    deltaLabel,
    skippedCount: progress.skippedSets,
    accessibilityLabel: `${w.planTitle}, confirmed ${dateLabel} at ${timeLabel}${durationLabel ? `, ${durationLabel}` : ''}. ${headline}.${deltaLabel ? ` ${deltaLabel}.` : ''}`,
  };
}

export function summarizeSession(w: ConfirmedWorkout): {
  card: SessionCard;
  exercises: ExerciseSummary[];
  notPerformed: { name: string; plannedSetCount: number }[];
  skipped: { exercise: string; setOrdinal: number; reason: string }[];
  volume: { kg: number; countedSets: number; bodyweightSets: number };
} {
  const exercises = w.actual.exercises.map((exercise) => toExerciseSummary(exercise, w));
  const notPerformed = plannedOnlyExercises(w.planned, w.actual).map((exercise) => ({ name: exercise.name, plannedSetCount: exercise.sets.length }));
  const skipped = exercises.flatMap((exercise) => exercise.rows
    .filter((row) => row.outcome === 'skipped' && row.skippedReason)
    .map((row) => ({ exercise: exercise.name, setOrdinal: row.ordinal, reason: row.skippedReason as string })));
  return { card: toSessionCard(w), exercises, notPerformed, skipped, volume: sessionVolume(w.actual) };
}

export function historyTotals(workouts: ConfirmedWorkout[]): { sessionCount: number; totalVolumeKg: number; totalSets: number; lastSessionDate: string | null } {
  const totalVolumeKg = workouts.reduce((sum, w) => sum + sessionVolume(w.actual).kg, 0);
  const totalSets = workouts.reduce((sum, w) => sum + computeWorkoutProgress(w.actual).totalSets, 0);
  const lastSessionDate = workouts.reduce<string | null>((latest, w) => (!latest || w.confirmedAt > latest ? w.confirmedAt : latest), null);
  return { sessionCount: workouts.length, totalVolumeKg, totalSets, lastSessionDate };
}
