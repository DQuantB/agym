import { describe, expect, it } from 'vitest';

import { buildHomeCalendarDays } from './homeSchedule';

describe('buildHomeCalendarDays', () => {
  it('builds a compact two-week calendar and attaches only accepted scheduled training', () => {
    const days = buildHomeCalendarDays('2026-07-25', 14, [
      { id: 'future-plan', title: 'Upper strength', scheduledFor: '2026-07-29' },
      { id: 'later-plan', title: 'Lower strength', scheduledFor: '2026-08-08' },
    ]);

    expect(days).toHaveLength(14);
    expect(days[0]).toMatchObject({ date: '2026-07-25', weekday: 'Sat', dayOfMonth: '25', plan: null });
    expect(days[4]).toMatchObject({ date: '2026-07-29', weekday: 'Wed', dayOfMonth: '29', plan: { id: 'future-plan', title: 'Upper strength' } });
    expect(days.every((day) => day.plan?.id !== 'later-plan')).toBe(true);
  });
});
