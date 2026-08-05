import { describe, expect, it } from 'vitest';

import type { CalendarPlan } from './calendarApi';
import { parsePlansCache, resolvePlansView, serializePlansCache } from './plansCache';

const samplePlan: CalendarPlan = {
  id: 'plan-1',
  status: 'active',
  source: 'external LLM',
  createdAt: '2026-08-01T00:00:00.000Z',
  scheduledFor: '2026-08-05',
  plan: {
    kind: 'gym_workout',
    schema_version: 1,
    scheduled_for: '2026-08-05',
    title: 'Push day',
    exercises: [{ client_id: 'ex-1', name: 'Bench press', sets: [{ reps: 8, weight_kg: 60, rest_seconds: 120 }] }],
  },
};

describe('serializePlansCache / parsePlansCache', () => {
  it('round-trips proposals, scheduled, and the superseded map', () => {
    const raw = serializePlansCache({
      proposals: [],
      scheduled: [samplePlan],
      supersededByDate: new Map([['2026-08-04', { id: 'old-1', title: 'Old push day' }]]),
    });
    const result = parsePlansCache(raw);
    expect(result).not.toBeNull();
    expect(result!.proposals).toEqual([]);
    expect(result!.scheduled).toEqual([samplePlan]);
    expect(result!.supersededByDate).toBeInstanceOf(Map);
    expect(result!.supersededByDate.get('2026-08-04')).toEqual({ id: 'old-1', title: 'Old push day' });
  });

  it('returns an empty but real Map when there is nothing superseded', () => {
    const raw = serializePlansCache({ proposals: [], scheduled: [], supersededByDate: new Map() });
    const result = parsePlansCache(raw);
    expect(result!.supersededByDate).toBeInstanceOf(Map);
    expect(result!.supersededByDate.size).toBe(0);
  });

  it('returns null for a garbage string', () => {
    expect(parsePlansCache('not json')).toBeNull();
  });

  it('returns null when a plan fails gymPlanSchema validation', () => {
    const corrupted = { proposals: [], scheduled: [{ ...samplePlan, plan: { ...samplePlan.plan, exercises: [] } }], supersededByDate: [] };
    expect(parsePlansCache(JSON.stringify(corrupted))).toBeNull();
  });

  it('returns null for valid JSON that does not match the payload shape', () => {
    expect(parsePlansCache('{}')).toBeNull();
  });
});

describe('resolvePlansView', () => {
  it('prefers live data once refreshed, even if cache exists', () => {
    expect(resolvePlansView({ refreshed: true, live: ['live'], cached: ['cached'] })).toEqual(['live']);
  });

  it('falls back to cache before the first refresh lands', () => {
    expect(resolvePlansView({ refreshed: false, live: ['live'], cached: ['cached'] })).toEqual(['cached']);
  });

  it('uses live data when there is no cache, even if not refreshed', () => {
    expect(resolvePlansView({ refreshed: false, live: ['live'], cached: null })).toEqual(['live']);
  });

  it('does not let an empty live array be masked by a non-empty cache once refreshed', () => {
    expect(resolvePlansView({ refreshed: true, live: [] as string[], cached: ['stale'] })).toEqual([]);
  });
});
