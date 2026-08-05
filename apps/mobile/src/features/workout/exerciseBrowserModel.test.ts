import { expect, it } from 'vitest';

import { buildExerciseBrowser, describeSetChipActions } from './exerciseBrowserModel';
import { focusExercise, repairFocusedWorkoutSession } from './focusedWorkoutSession';
import type { ActualData } from './workoutApi';

const actualData: ActualData = {
  kind: 'gym_workout_execution',
  schema_version: 1,
  exercises: [
    {
      client_id: 'bench', name: 'Bench press', user_added: false,
      sets: [
        { reps: 8, weight_kg: 80, rest_seconds: 120, completed: true, skipped_reason: null, user_added: false },
        { reps: 8, weight_kg: 80, rest_seconds: 120, completed: false, skipped_reason: null, user_added: false },
      ],
    },
    {
      client_id: 'row', name: 'Row', user_added: false,
      sets: [{ reps: 10, weight_kg: 60, rest_seconds: 90, completed: false, skipped_reason: null, user_added: false }],
    },
  ],
};

it('rows follow the queue order, not raw array order', () => {
  const session = repairFocusedWorkoutSession(actualData, { exerciseOrder: ['row', 'bench'] });
  const rows = buildExerciseBrowser(actualData, session);
  expect(rows.map((row) => row.exerciseId)).toEqual(['row', 'bench']);
});

it('each outcome has a distinct glyph, so status is never color-only', () => {
  const session = repairFocusedWorkoutSession(actualData);
  const rows = buildExerciseBrowser(actualData, session);
  const bench = rows.find((row) => row.exerciseId === 'bench')!;
  const glyphs = new Set(bench.chips.map((chip) => chip.glyph));
  expect(glyphs.size).toBe(bench.chips.length);
});

it('exactly one chip is focused, and it is the focused exercise\'s first pending set', () => {
  const session = repairFocusedWorkoutSession(actualData);
  const rows = buildExerciseBrowser(actualData, session);
  const focusedChips = rows.flatMap((row) => row.chips).filter((chip) => chip.isFocused);
  expect(focusedChips).toHaveLength(1);
  expect(focusedChips[0]).toMatchObject({ setIndex: 1 });
});

it('a manual override moves isFocused off the auto-current exercise entirely', () => {
  const session = focusExercise(repairFocusedWorkoutSession(actualData, { exerciseOrder: ['bench', 'row'] }), 'row');
  const rows = buildExerciseBrowser(actualData, session);
  expect(rows.find((row) => row.exerciseId === 'bench')!.isFocused).toBe(false);
  expect(rows.find((row) => row.exerciseId === 'row')!.isFocused).toBe(true);
});

it('canDelete is true only for user_added sets in a multi-set exercise, mirroring the reducer guard', () => {
  const withAdded: ActualData = structuredClone(actualData);
  withAdded.exercises[0].sets.push({ reps: 5, weight_kg: 40, rest_seconds: 90, completed: false, skipped_reason: null, user_added: true });
  const session = repairFocusedWorkoutSession(withAdded);
  const rows = buildExerciseBrowser(withAdded, session);
  const bench = rows.find((row) => row.exerciseId === 'bench')!;

  expect(bench.chips[0].canDelete).toBe(false);
  expect(bench.chips[1].canDelete).toBe(false);
  expect(bench.chips[2].canDelete).toBe(true);

  const row = rows.find((r) => r.exerciseId === 'row')!;
  expect(row.chips[0].canDelete).toBe(false);
});

it('canReset is true for completed and skipped, false for pending', () => {
  const session = repairFocusedWorkoutSession(actualData);
  const rows = buildExerciseBrowser(actualData, session);
  const bench = rows.find((row) => row.exerciseId === 'bench')!;
  expect(bench.chips[0].canReset).toBe(true);
  expect(bench.chips[1].canReset).toBe(false);
});

it('every chip and pill accessibilityLabel contains the exercise name and the state word', () => {
  const session = repairFocusedWorkoutSession(actualData);
  const rows = buildExerciseBrowser(actualData, session);
  const bench = rows.find((row) => row.exerciseId === 'bench')!;
  expect(bench.accessibilityLabel).toContain('Bench press');
  expect(bench.accessibilityLabel).toMatch(/done|current|not started/);
  expect(bench.chips[0].accessibilityLabel).toBe('Bench press set 1, completed');
  expect(bench.chips[1].accessibilityLabel).toContain('current');
});

it('a fully settled exercise reports the done glyph and its full ratio', () => {
  const settled: ActualData = structuredClone(actualData);
  settled.exercises[0].sets[1].completed = true;
  const session = repairFocusedWorkoutSession(settled);
  const rows = buildExerciseBrowser(settled, session);
  const bench = rows.find((row) => row.exerciseId === 'bench')!;

  expect(bench.isFinished).toBe(true);
  expect(bench.pillGlyph).toBe('✓');
  expect(bench.summary).toBe('2/2');
});

it('describeSetChipActions names why delete is blocked for a planned set vs. a single-set exercise', () => {
  const plannedBlocked = describeSetChipActions(actualData.exercises[0], 0);
  expect(plannedBlocked.canDelete).toBe(false);
  expect(plannedBlocked.deleteBlocked).toMatch(/planned/);

  const withAdded = structuredClone(actualData);
  withAdded.exercises[1].sets[0].user_added = true;
  const singleSetBlocked = describeSetChipActions(withAdded.exercises[1], 0);
  expect(singleSetBlocked.canDelete).toBe(false);
  expect(singleSetBlocked.deleteBlocked).toMatch(/at least one set/);
});

it('describeSetChipActions title names the logged weight and reps', () => {
  const actions = describeSetChipActions(actualData.exercises[0], 0);
  expect(actions.title).toBe('Set 1 — 80 kg × 8');
});
