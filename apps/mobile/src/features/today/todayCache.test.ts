import { describe, expect, it } from 'vitest';

import { parseTodayCache, serializeTodayCache, type TodayCachePayload } from './todayCache';

const samplePayload: TodayCachePayload = {
  date: '2026-08-05',
  remote: {
    activePlan: { id: 'plan-1', title: 'Push day', scheduledFor: '2026-08-05' },
    execution: { id: 'exec-1', status: 'in_progress', completedAt: null },
    proposal: null,
  },
  upcomingPlans: [
    { id: 'plan-1', title: 'Push day', scheduledFor: '2026-08-05' },
    { id: 'plan-2', title: 'Pull day', scheduledFor: '2026-08-06' },
  ],
};

describe('serializeTodayCache / parseTodayCache', () => {
  it('round-trips a payload for the same date', () => {
    const raw = serializeTodayCache(samplePayload);
    expect(parseTodayCache(raw, '2026-08-05')).toEqual(samplePayload);
  });

  it('drops remote but keeps upcomingPlans when the cached date does not match today', () => {
    const raw = serializeTodayCache(samplePayload);
    const result = parseTodayCache(raw, '2026-08-06');
    expect(result).toEqual({
      date: '2026-08-06',
      remote: { activePlan: null, execution: null, proposal: null },
      upcomingPlans: samplePayload.upcomingPlans,
    });
  });

  it('returns null for a garbage string', () => {
    expect(parseTodayCache('not json', '2026-08-05')).toBeNull();
  });

  it('returns null for valid JSON that does not match the payload shape', () => {
    expect(parseTodayCache('{}', '2026-08-05')).toBeNull();
    expect(parseTodayCache('{"date":"2026-08-05"}', '2026-08-05')).toBeNull();
  });

  it('returns null when execution.status is not a recognized value', () => {
    const corrupted = { ...samplePayload, remote: { ...samplePayload.remote, execution: { id: 'exec-1', status: 'bogus', completedAt: null } } };
    expect(parseTodayCache(JSON.stringify(corrupted), '2026-08-05')).toBeNull();
  });
});
