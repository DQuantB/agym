import { describe, expect, it } from 'vitest';

import { addCalendarDays, buildHomeCalendarDays, weekStart } from './homeSchedule';

describe('home calendar date helpers', () => {
  it('moves one day at a time across month boundaries', () => {
    expect(addCalendarDays('2026-07-31', 1)).toBe('2026-08-01');
    expect(addCalendarDays('2026-08-01', -1)).toBe('2026-07-31');
  });

  it('anchors the seven-day strip to Monday for any selected day', () => {
    expect(weekStart('2026-07-26')).toBe('2026-07-20');
    expect(weekStart('2026-07-27')).toBe('2026-07-27');
  });

  it('builds a one-week strip and attaches only accepted scheduled training', () => {
    const days = buildHomeCalendarDays('2026-07-20', 7, [
      { id: 'future-plan', title: 'Upper strength', scheduledFor: '2026-07-22' },
      { id: 'later-plan', title: 'Lower strength', scheduledFor: '2026-08-08' },
    ]);

    expect(days).toHaveLength(7);
    expect(days[0]).toMatchObject({ date: '2026-07-20', weekday: 'Mon', dayOfMonth: '20', plan: null });
    expect(days[2]).toMatchObject({ date: '2026-07-22', weekday: 'Wed', dayOfMonth: '22', plan: { id: 'future-plan', title: 'Upper strength' } });
    expect(days.every((day) => day.plan?.id !== 'later-plan')).toBe(true);
  });
});
