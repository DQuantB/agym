import { describe, expect, it } from 'vitest';
import {
  CanonicalEventSchema,
  DraftEventSchema,
  EventPayloadSchema,
  RawLogSchema,
  UncertaintyFlagSchema,
} from './schemas';
import type { EventPayload } from './types';

const payloadSamples: EventPayload[] = [
  {
    kind: 'workout',
    exercises: [
      {
        name: 'squat',
        sets: [{ reps: 8, weightKg: 80, rpe: 8 }],
      },
    ],
    durationMin: 60,
    notes: 'felt solid',
  },
  {
    kind: 'meal',
    description: 'oats and yogurt',
    kcal: 650,
    proteinG: 35,
  },
  {
    kind: 'bodyweight',
    weightKg: 82.4,
  },
  {
    kind: 'sleep',
    durationH: 7.5,
    quality: 'good',
  },
  {
    kind: 'pain',
    bodyPart: 'knee',
    description: 'right knee discomfort after squats',
    severity: 3,
    notes: null,
  },
  {
    kind: 'note',
    text: 'unstructured text is preserved instead of dropped',
  },
];

const draftEvent = {
  id: 'draft_1',
  rawLogId: 'raw_1',
  date: '2026-07-11',
  time: null,
  payload: payloadSamples[0],
  uncertaintyFlags: [
    {
      field: 'payload.exercises.0.sets.0.weightKg',
      reason: 'user gave an approximate load',
    },
  ],
  sourceText: 'squat 1x8@80kg maybe',
  parserVersion: 'mock-v1',
  schemaVersion: 1,
};

describe('domain schemas', () => {
  it('validates raw logs with immutable manual source and schema version', () => {
    expect(
      RawLogSchema.parse({
        id: 'raw_1',
        text: 'bench 3x5@80kg',
        loggedAt: '2026-07-11T20:00:00.000Z',
        defaultDate: '2026-07-11',
        source: 'manual',
        schemaVersion: 1,
      }),
    ).toMatchObject({ id: 'raw_1', source: 'manual', schemaVersion: 1 });
  });

  it('validates every v0 payload kind in the discriminated union', () => {
    for (const payload of payloadSamples) {
      expect(EventPayloadSchema.safeParse(payload).success, payload.kind).toBe(true);
    }
  });

  it('rejects malformed samples for each payload kind with useful error paths', () => {
    const invalidSamples = [
      [{ kind: 'workout', exercises: [{ name: '', sets: [] }], durationMin: null, notes: null }, ['exercises', 0, 'name']],
      [{ kind: 'meal', description: '', kcal: null, proteinG: null }, ['description']],
      [{ kind: 'bodyweight', weightKg: -1 }, ['weightKg']],
      [{ kind: 'sleep', durationH: null, quality: 'excellent' }, ['quality']],
      [{ kind: 'pain', bodyPart: null, description: 'knee pain', severity: 11, notes: null }, ['severity']],
      [{ kind: 'note', text: '' }, ['text']],
    ] as const;

    for (const [sample, expectedPath] of invalidSamples) {
      const result = EventPayloadSchema.safeParse(sample);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => issue.path.join('.') === expectedPath.join('.'))).toBe(true);
      }
    }
  });

  it('validates uncertainty flags with explicit field and reason', () => {
    expect(UncertaintyFlagSchema.safeParse({ field: 'date', reason: 'relative date was parsed from user text' }).success).toBe(true);
    const result = UncertaintyFlagSchema.safeParse({ field: '', reason: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path.join('.'))).toEqual(['field', 'reason']);
    }
  });

  it('validates v0 draft events with local date/time, source text, and parser version', () => {
    const parsed = DraftEventSchema.parse(draftEvent);

    expect(parsed.date).toBe('2026-07-11');
    expect(parsed.time).toBeNull();
    expect(parsed.parserVersion).toBe('mock-v1');
    expect('occurredAt' in parsed).toBe(false);
  });

  it('requires local date format and rejects fabricated UTC instants on draft events', () => {
    const result = DraftEventSchema.safeParse({
      ...draftEvent,
      date: '2026-07-11T20:00:00.000Z',
      time: '8pm',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path.join('.'))).toEqual(['date', 'time']);
    }
  });

  it('canonical events extend draft events with confirmation metadata, provenance, and original payload', () => {
    const canonical = CanonicalEventSchema.parse({
      ...draftEvent,
      confirmedAt: '2026-07-11T20:05:00.000Z',
      editedByUser: true,
      provenance: 'user_confirmed',
      originalPayload: payloadSamples[5],
    });

    expect(canonical.confirmedAt).toBe('2026-07-11T20:05:00.000Z');
    expect(canonical.editedByUser).toBe(true);
    expect(canonical.provenance).toBe('user_confirmed');
    expect(canonical.originalPayload.kind).toBe('note');
  });

  it('rejects canonical events that omit provenance or originalPayload', () => {
    const missingTrustFields = {
      ...draftEvent,
      confirmedAt: '2026-07-11T20:05:00.000Z',
      editedByUser: false,
    };

    const result = CanonicalEventSchema.safeParse(missingTrustFields);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path.join('.')).sort()).toEqual(['originalPayload', 'provenance']);
    }
  });
});
