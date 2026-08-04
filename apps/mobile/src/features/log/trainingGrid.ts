import { z } from 'zod';

import { addCalendarDays, weekStart } from '@/features/today/homeSchedule';
import { daysBetween } from '@/lib/dateLabels';

import { gymPlanSchema, type ActualData } from '../workout/workoutApi';
import { computeWorkoutProgress, formatVolumeKg, sessionVolume } from '../workout/workoutMetrics';

export const TRAINING_GRID_WEEKS = 12;

/**
 * Raw workout_executions row shape (status='completed' only). scheduled_for
 * is a plain date column (timezone-free) -- the actual training day, not
 * when the user pressed confirm -- so it is the right bucketing key, unlike
 * canonical_events.confirmed_at which is a full timestamp.
 */
export type DbTrainingExecutionRow = {
  scheduled_for: string;
  planned_snapshot: unknown;
  execution_data: unknown;
};

export type TrainingSessionRow = {
  scheduledFor: string;
  volumeKg: number;
  completedSets: number;
  /** null when planned_snapshot is missing or does not parse as a GymPlan -- distinct from 0. */
  plannedSets: number | null;
};

export type TrainingGridCell = {
  date: string;
  sessionCount: number;
  volumeKg: number;
  completedSets: number;
  /** null when there is no session, or every session that day lacked a planned reference. */
  plannedSets: number | null;
};

export type GridMetric = 'volume' | 'sets' | 'adherence';

const actualDataEnvelopeSchema = z.object({
  kind: z.literal('gym_workout_execution'),
  schema_version: z.literal(1),
  exercises: z.array(z.any()),
});

/**
 * Same tolerant-parse convention as workoutApi.loadActiveWorkout: skip rows
 * that don't match the expected shape instead of throwing, mirroring how
 * logApi.parseConfirmedWorkout already treats malformed history rows.
 */
export function parseTrainingSessionRow(row: DbTrainingExecutionRow): TrainingSessionRow | null {
  const actual = actualDataEnvelopeSchema.safeParse(row.execution_data);
  if (!actual.success) return null;
  const actualData = actual.data as ActualData;

  const progress = computeWorkoutProgress(actualData);
  const volume = sessionVolume(actualData);
  const plan = gymPlanSchema.safeParse(row.planned_snapshot);
  const plannedSets = plan.success ? plan.data.exercises.reduce((total, exercise) => total + exercise.sets.length, 0) : null;

  return {
    scheduledFor: row.scheduled_for,
    volumeKg: volume.kg,
    completedSets: progress.completedSets,
    plannedSets,
  };
}

/** Buckets sessions into a contiguous day series, inclusive of both ends. */
export function buildTrainingGridDays(fromDate: string, toDate: string, rows: TrainingSessionRow[]): TrainingGridCell[] {
  const span = daysBetween(fromDate, toDate);
  if (span < 0) throw new Error('fromDate must not be after toDate');

  const byDate = new Map<string, TrainingSessionRow[]>();
  for (const row of rows) {
    const bucket = byDate.get(row.scheduledFor) ?? [];
    bucket.push(row);
    byDate.set(row.scheduledFor, bucket);
  }

  return Array.from({ length: span + 1 }, (_, offset) => {
    const date = addCalendarDays(fromDate, offset);
    const sessions = byDate.get(date) ?? [];
    if (!sessions.length) return { date, sessionCount: 0, volumeKg: 0, completedSets: 0, plannedSets: null };

    const knownPlanned = sessions.filter((session) => session.plannedSets !== null);
    return {
      date,
      sessionCount: sessions.length,
      volumeKg: sessions.reduce((total, session) => total + session.volumeKg, 0),
      completedSets: sessions.reduce((total, session) => total + session.completedSets, 0),
      plannedSets: knownPlanned.length ? knownPlanned.reduce((total, session) => total + (session.plannedSets ?? 0), 0) : null,
    };
  });
}

/** The 12-week, Monday-start window ending in the current week, given today's local date. */
export function trainingGridRangeEndingToday(today: string): { fromDate: string; toDate: string } {
  const currentWeekStart = weekStart(today);
  const fromDate = addCalendarDays(currentWeekStart, -7 * (TRAINING_GRID_WEEKS - 1));
  const toDate = addCalendarDays(fromDate, TRAINING_GRID_WEEKS * 7 - 1);
  return { fromDate, toDate };
}

/** Splits a contiguous Monday-aligned day series into week-major columns of 7. */
export function chunkIntoWeeks(days: TrainingGridCell[]): TrainingGridCell[][] {
  const weeks: TrainingGridCell[][] = [];
  for (let index = 0; index < days.length; index += 7) weeks.push(days.slice(index, index + 7));
  return weeks;
}

/**
 * The magnitude used to pick a density step. null means "no data for this
 * metric on this day" (not zero) -- adherence needs a planned count to be
 * meaningful, and is otherwise unavailable rather than zero.
 */
export function metricMagnitude(cell: TrainingGridCell, metric: GridMetric): number | null {
  if (cell.sessionCount === 0) return null;
  if (metric === 'volume') return cell.volumeKg;
  if (metric === 'sets') return cell.completedSets;
  if (cell.plannedSets === null || cell.plannedSets === 0) return null;
  return cell.completedSets / cell.plannedSets;
}

export function maxMetricMagnitude(cells: TrainingGridCell[], metric: GridMetric): number {
  const values = cells
    .map((cell) => metricMagnitude(cell, metric))
    .filter((value): value is number => value !== null && value > 0);
  return values.length ? Math.max(...values) : 0;
}

/** Relative (quartile) bucketing against the window's own max, GitHub-heatmap style. */
export function densityStep(cell: TrainingGridCell, metric: GridMetric, maxMagnitude: number): 0 | 1 | 2 | 3 | 4 {
  const magnitude = metricMagnitude(cell, metric);
  if (magnitude === null || magnitude <= 0 || maxMagnitude <= 0) return 0;
  const ratio = magnitude / maxMagnitude;
  if (ratio > 0.75) return 4;
  if (ratio > 0.5) return 3;
  if (ratio > 0.25) return 2;
  return 1;
}

export function gridCellAccessibilityLabel(cell: TrainingGridCell, metric: GridMetric, dateLabel: string): string {
  if (cell.sessionCount === 0) return `${dateLabel}: no training logged`;
  const sessionsLabel = `${cell.sessionCount} session${cell.sessionCount === 1 ? '' : 's'}`;
  if (metric === 'volume') return `${dateLabel}: ${sessionsLabel}, ${formatVolumeKg(cell.volumeKg)}`;
  if (metric === 'sets') return `${dateLabel}: ${sessionsLabel}, ${cell.completedSets} sets completed`;
  return cell.plannedSets === null
    ? `${dateLabel}: ${sessionsLabel}, no planned reference available`
    : `${dateLabel}: ${sessionsLabel}, ${cell.completedSets} of ${cell.plannedSets} planned sets completed`;
}
