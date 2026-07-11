import type { CanonicalEvent, RawLog } from '../domain/types';

export function makeRawLog(overrides: Partial<RawLog> = {}): RawLog {
  return {
    id: 'raw-1',
    text: 'bench 3x8 at 80kg',
    loggedAt: '2026-07-11T12:00:00.000Z',
    defaultDate: '2026-07-11',
    source: 'manual',
    schemaVersion: 1,
    ...overrides,
  };
}

export function makeCanonicalEvent(overrides: Partial<CanonicalEvent> = {}): CanonicalEvent {
  const payload: CanonicalEvent['payload'] = {
    kind: 'workout',
    exercises: [
      {
        name: 'bench press',
        sets: [{ reps: 8, weightKg: 80, rpe: null }],
      },
    ],
    durationMin: null,
    notes: null,
  };

  return {
    id: 'event-1',
    rawLogId: 'raw-1',
    date: '2026-07-11',
    time: '12:30',
    payload,
    uncertaintyFlags: [],
    sourceText: 'bench 3x8 at 80kg',
    parserVersion: 'mock-v1',
    schemaVersion: 1,
    confirmedAt: '2026-07-11T12:05:00.000Z',
    editedByUser: false,
    provenance: 'user_confirmed',
    originalPayload: payload,
    ...overrides,
  };
}
