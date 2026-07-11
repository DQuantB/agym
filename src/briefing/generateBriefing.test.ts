import { describe, expect, it } from 'vitest';
import type { CanonicalEvent } from '../domain/types';
import { makeCanonicalEvent } from '../test/factories';
import { generateBriefing } from './generateBriefing';

const base = {
  id: 'e1',
  rawLogId: 'r1',
  date: '2026-07-11',
  time: null,
  sourceText: 'source',
  parserVersion: 'mock-v1',
  schemaVersion: 1 as const,
  confirmedAt: '2026-07-11T12:00:00.000Z',
  editedByUser: false,
  provenance: 'user_confirmed' as const,
  uncertaintyFlags: [],
};

describe('generateBriefing', () => {
  it('renders required sections, disclaimer, and pain near top', () => {
    const events: CanonicalEvent[] = [
      { ...base, payload: { kind: 'pain', bodyPart: 'knee', description: 'knee started aching', severity: null, notes: null }, originalPayload: { kind: 'pain', bodyPart: 'knee', description: 'knee started aching', severity: null, notes: null } },
    ];
    const markdown = generateBriefing(events, { from: '2026-07-01', to: '2026-07-14', generatedAt: '2026-07-14T18:00:00Z' });

    expect(markdown).toContain('> User-reported log data only. Not medical advice.');
    expect(markdown.indexOf('## ⚠ Pain / discomfort')).toBeLessThan(markdown.indexOf('## Training'));
    expect(markdown).toContain('> user wrote: "knee started aching"');
    expect(markdown).not.toMatch(/consider|recommend|diagnos|treatment/i);
  });

  it('states empty data plainly', () => {
    const markdown = generateBriefing([], { from: '2026-07-01', to: '2026-07-14', generatedAt: '2026-07-14T18:00:00Z' });
    expect(markdown).toContain('Confirmed events: 0');
    expect(markdown).toContain('No workout events logged in this period.');
    expect(markdown).toContain('Not medical advice.');
  });

  it('reports volume, nutrition gaps, bodyweight delta, and uncertainty flags without inventing missing data', () => {
    // Hand-checks:
    // - Training volume lines: 2 sets for squat at 100 kg and 5 reps each should render as two set lines, not a fabricated total.
    // - Nutrition coverage: range is 2026-07-01..2026-07-03 = 3 days; meals exist on 1 day, so 2 days have no nutrition data.
    // - Bodyweight delta: 82.4 - 82.0 = 0.4 kg.
    const events: CanonicalEvent[] = [
      makeCanonicalEvent({
        id: 'workout',
        date: '2026-07-01',
        payload: { kind: 'workout', exercises: [{ name: 'squat', sets: [{ reps: 5, weightKg: 100, rpe: null }, { reps: 5, weightKg: 100, rpe: null }] }], durationMin: null, notes: null },
        originalPayload: { kind: 'workout', exercises: [{ name: 'squat', sets: [{ reps: 5, weightKg: 100, rpe: null }, { reps: 5, weightKg: 100, rpe: null }] }], durationMin: null, notes: null },
        uncertaintyFlags: [{ field: 'payload.exercises.0.sets.weightKg', reason: 'weight inferred' }],
      }),
      makeCanonicalEvent({ id: 'meal', date: '2026-07-02', payload: { kind: 'meal', description: 'oats', kcal: 500, proteinG: null }, originalPayload: { kind: 'meal', description: 'oats', kcal: 500, proteinG: null } }),
      makeCanonicalEvent({ id: 'bw1', date: '2026-07-01', payload: { kind: 'bodyweight', weightKg: 82 }, originalPayload: { kind: 'bodyweight', weightKg: 82 } }),
      makeCanonicalEvent({ id: 'bw2', date: '2026-07-03', payload: { kind: 'bodyweight', weightKg: 82.4 }, originalPayload: { kind: 'bodyweight', weightKg: 82.4 } }),
    ];

    const markdown = generateBriefing(events, { from: '2026-07-01', to: '2026-07-03', generatedAt: '2026-07-04T00:00:00Z' });

    expect(markdown.match(/squat: 5 reps @ 100 kg/g)).toHaveLength(2);
    expect(markdown).toContain('No nutrition data on 2 of 3 days in range.');
    expect(markdown).toContain('First: 82 kg · last: 82.4 kg · delta: 0.4 kg');
    expect(markdown).toContain('payload.exercises.0.sets.weightKg (weight inferred)');
    expect(markdown).toMatchInlineSnapshot(`
"# AGym Coach Briefing
Period: 2026-07-01 to 2026-07-03

> User-reported log data only. Not medical advice.

## Summary
- Confirmed events: 4
- Workouts: 1 · Meals: 1 · Bodyweight: 2 · Sleep: 0 · Pain: 0 · Notes: 0

## ⚠ Pain / discomfort
No pain/discomfort events logged in this period.

## Training
### 2026-07-01
- squat: 5 reps @ 100 kg
- squat: 5 reps @ 100 kg

## Nutrition
### 2026-07-02
- oats — kcal: 500 · protein: — g
1 of 1 meal events have kcal stated; 1 of 1 have no protein stated.
No nutrition data on 2 of 3 days in range.

## Bodyweight
- 2026-07-01 12:30: 82 kg
- 2026-07-03 12:30: 82.4 kg
First: 82 kg · last: 82.4 kg · delta: 0.4 kg

## Sleep
No sleep events logged in this period.

## Notes
No note events logged in this period.

## Data quality
1 uncertainty flags in this period:
- 2026-07-01 · workout · payload.exercises.0.sets.weightKg (weight inferred)
Uncertain fields are flagged for user review.

## Export metadata
- schemaVersion: 1
- generatedAt: 2026-07-04T00:00:00Z
- events: 4
- range: 2026-07-01 to 2026-07-03"
`);
  });
});
