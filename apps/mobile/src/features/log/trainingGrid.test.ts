import { describe, expect, it } from 'vitest';

import {
  buildTrainingGridDays,
  chunkIntoWeeks,
  densityStep,
  gridCellAccessibilityLabel,
  maxMetricMagnitude,
  metricMagnitude,
  parseTrainingSessionRow,
  trainingGridRangeEndingToday,
  type DbTrainingExecutionRow,
  type TrainingGridCell,
  type TrainingSessionRow,
} from './trainingGrid';

const plannedSnapshot = {
  kind: 'gym_workout', schema_version: 1, scheduled_for: '2026-07-20', title: 'Push day',
  exercises: [
    { client_id: 'bench', name: 'Bench press', sets: [{ reps: 5 }, { reps: 5 }] },
    { client_id: 'ohp', name: 'Overhead press', sets: [{ reps: 8 }, { reps: 8 }, { reps: 8 }] },
  ],
};

function row(overrides: Partial<DbTrainingExecutionRow> = {}): DbTrainingExecutionRow {
  return {
    scheduled_for: '2026-07-20',
    planned_snapshot: plannedSnapshot,
    execution_data: {
      kind: 'gym_workout_execution', schema_version: 1,
      exercises: [
        { client_id: 'bench', name: 'Bench press', user_added: false, sets: [
          { reps: 5, weight_kg: 80, rest_seconds: 120, completed: true, skipped_reason: null, user_added: false },
          { reps: 5, weight_kg: 80, rest_seconds: 120, completed: true, skipped_reason: null, user_added: false },
        ] },
      ],
    },
    ...overrides,
  };
}

describe('parseTrainingSessionRow', () => {
  it('computes volume and completed sets from execution_data, and planned sets from planned_snapshot', () => {
    expect(parseTrainingSessionRow(row())).toEqual({
      scheduledFor: '2026-07-20',
      volumeKg: 800, // 2 sets x 5 reps x 80kg
      completedSets: 2,
      plannedSets: 5, // 2 + 3 prescribed sets across both exercises
    });
  });

  it('counts bodyweight-only completed sets without contributing to volume', () => {
    const parsed = parseTrainingSessionRow(row({
      execution_data: {
        kind: 'gym_workout_execution', schema_version: 1,
        exercises: [{ client_id: 'pushup', name: 'Push-up', user_added: false, sets: [
          { reps: 12, weight_kg: null, rest_seconds: 90, completed: true, skipped_reason: null, user_added: false },
        ] }],
      },
    }));
    expect(parsed).toEqual({ scheduledFor: '2026-07-20', volumeKg: 0, completedSets: 1, plannedSets: 5 });
  });

  it('reports plannedSets as null, not 0, when planned_snapshot is missing or malformed', () => {
    expect(parseTrainingSessionRow(row({ planned_snapshot: null }))?.plannedSets).toBeNull();
    expect(parseTrainingSessionRow(row({ planned_snapshot: { kind: 'gym_workout' } }))?.plannedSets).toBeNull();
  });

  it('skips rows whose execution_data does not match the expected envelope', () => {
    expect(parseTrainingSessionRow(row({ execution_data: {} }))).toBeNull();
    expect(parseTrainingSessionRow(row({ execution_data: { kind: 'gym_workout_execution', schema_version: 2, exercises: [] } }))).toBeNull();
  });
});

describe('buildTrainingGridDays', () => {
  const session = (overrides: Partial<TrainingSessionRow> = {}): TrainingSessionRow => ({
    scheduledFor: '2026-07-20', volumeKg: 100, completedSets: 3, plannedSets: 3, ...overrides,
  });

  it('produces a zeroed, unavailable-adherence cell for every day with no session', () => {
    const days = buildTrainingGridDays('2026-07-20', '2026-07-20', []);
    expect(days).toEqual([{ date: '2026-07-20', sessionCount: 0, volumeKg: 0, completedSets: 0, plannedSets: null }]);
  });

  it('sums multiple same-day sessions, and only sums plannedSets across sessions that have one', () => {
    const days = buildTrainingGridDays('2026-07-20', '2026-07-20', [
      session({ volumeKg: 100, completedSets: 3, plannedSets: 3 }),
      session({ volumeKg: 50, completedSets: 2, plannedSets: null }),
    ]);
    expect(days).toEqual([{ date: '2026-07-20', sessionCount: 2, volumeKg: 150, completedSets: 5, plannedSets: 3 }]);
  });

  it('fills a contiguous range and slots sessions onto their date only', () => {
    const days = buildTrainingGridDays('2026-07-19', '2026-07-21', [session({ scheduledFor: '2026-07-20' })]);
    expect(days.map((day) => day.date)).toEqual(['2026-07-19', '2026-07-20', '2026-07-21']);
    expect(days[0].sessionCount).toBe(0);
    expect(days[1].sessionCount).toBe(1);
    expect(days[2].sessionCount).toBe(0);
  });

  it('rejects an inverted range', () => {
    expect(() => buildTrainingGridDays('2026-07-21', '2026-07-19', [])).toThrow('fromDate must not be after toDate');
  });
});

describe('trainingGridRangeEndingToday', () => {
  it('spans exactly 12 Monday-start weeks ending in the week containing today', () => {
    // 2026-07-27 is a Monday (see homeSchedule.test.ts).
    const { fromDate, toDate } = trainingGridRangeEndingToday('2026-07-27');
    expect(fromDate).toBe('2026-05-11'); // 11 weeks before this week's Monday
    expect(toDate).toBe('2026-08-02'); // Sunday closing the 12th week
  });

  it('anchors a mid-week today to that week\'s Monday, not the day itself', () => {
    const { toDate } = trainingGridRangeEndingToday('2026-07-29');
    expect(toDate).toBe('2026-08-02');
  });
});

describe('chunkIntoWeeks', () => {
  it('splits a contiguous day series into week-major columns of 7', () => {
    const days = buildTrainingGridDays('2026-07-20', '2026-08-02', []);
    const weeks = chunkIntoWeeks(days);
    expect(weeks).toHaveLength(2);
    expect(weeks[0]).toHaveLength(7);
    expect(weeks[1]).toHaveLength(7);
    expect(weeks[0][0].date).toBe('2026-07-20');
    expect(weeks[1][0].date).toBe('2026-07-27');
  });
});

describe('metricMagnitude, maxMetricMagnitude, densityStep', () => {
  const cells: TrainingGridCell[] = [
    { date: '2026-07-20', sessionCount: 0, volumeKg: 0, completedSets: 0, plannedSets: null },
    { date: '2026-07-21', sessionCount: 1, volumeKg: 100, completedSets: 4, plannedSets: 4 },
    { date: '2026-07-22', sessionCount: 1, volumeKg: 400, completedSets: 8, plannedSets: 10 },
  ];

  it('reports null magnitude for a day with no session, not zero', () => {
    expect(metricMagnitude(cells[0], 'volume')).toBeNull();
    expect(metricMagnitude(cells[0], 'adherence')).toBeNull();
  });

  it('reports adherence as a completed/planned ratio, unavailable without a planned count', () => {
    const noPlan: TrainingGridCell = { date: '2026-07-23', sessionCount: 1, volumeKg: 10, completedSets: 2, plannedSets: null };
    expect(metricMagnitude(cells[1], 'adherence')).toBe(1); // 4/4
    expect(metricMagnitude(cells[2], 'adherence')).toBeCloseTo(0.8); // 8/10
    expect(metricMagnitude(noPlan, 'adherence')).toBeNull();
  });

  it('buckets the busiest day into the top step and empty days into step 0', () => {
    const max = maxMetricMagnitude(cells, 'volume');
    expect(max).toBe(400);
    expect(densityStep(cells[0], 'volume', max)).toBe(0);
    expect(densityStep(cells[1], 'volume', max)).toBe(1); // 100/400 = 0.25, not > 0.25
    expect(densityStep(cells[2], 'volume', max)).toBe(4); // 400/400 = 1
  });

  it('returns step 0 for every cell when nothing in the window has this metric at all', () => {
    const empty: TrainingGridCell[] = [{ date: '2026-07-20', sessionCount: 0, volumeKg: 0, completedSets: 0, plannedSets: null }];
    expect(maxMetricMagnitude(empty, 'adherence')).toBe(0);
    expect(densityStep(empty[0], 'adherence', 0)).toBe(0);
  });
});

describe('gridCellAccessibilityLabel', () => {
  it('states no training for an empty day', () => {
    const cell: TrainingGridCell = { date: '2026-07-20', sessionCount: 0, volumeKg: 0, completedSets: 0, plannedSets: null };
    expect(gridCellAccessibilityLabel(cell, 'volume', 'Mon 20 Jul')).toBe('Mon 20 Jul: no training logged');
  });

  it('states volume, sets, and planned-vs-completed adherence for a real session', () => {
    const cell: TrainingGridCell = { date: '2026-07-20', sessionCount: 1, volumeKg: 400, completedSets: 8, plannedSets: 10 };
    expect(gridCellAccessibilityLabel(cell, 'volume', 'Mon 20 Jul')).toBe('Mon 20 Jul: 1 session, 400 kg');
    expect(gridCellAccessibilityLabel(cell, 'sets', 'Mon 20 Jul')).toBe('Mon 20 Jul: 1 session, 8 sets completed');
    expect(gridCellAccessibilityLabel(cell, 'adherence', 'Mon 20 Jul')).toBe('Mon 20 Jul: 1 session, 8 of 10 planned sets completed');
  });

  it('states adherence is unavailable rather than implying zero', () => {
    const cell: TrainingGridCell = { date: '2026-07-20', sessionCount: 1, volumeKg: 50, completedSets: 3, plannedSets: null };
    expect(gridCellAccessibilityLabel(cell, 'adherence', 'Mon 20 Jul')).toBe('Mon 20 Jul: 1 session, no planned reference available');
  });
});
