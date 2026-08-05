import { expect, it } from 'vitest';

import { daysBetween, formatClockTime, formatDayMonth, formatUpdatedAgo, formatWeekdayDate, relativeDayLabel } from './dateLabels';

it('formats a date-only string as weekday + day + month, anchored so local timezone cannot shift the day', () => {
  expect(formatWeekdayDate('2026-07-21')).toBe('Tue 21 Jul');
  expect(formatWeekdayDate('2026-01-01')).toBe('Thu 1 Jan');
});

it('formats a full timestamp using its own weekday, not the date-only anchor path', () => {
  expect(formatWeekdayDate('2026-07-21T22:30:00.000Z')).toMatch(/^\w{3} \d{1,2} \w{3}$/);
});

it('formats day + month without a weekday', () => {
  expect(formatDayMonth('2026-07-21')).toBe('21 Jul');
});

it('formats clock time from a timestamp using the runtime local timezone, zero-padded', () => {
  const timestamp = '2026-07-21T05:07:00.000Z';
  const expected = new Date(timestamp);
  const hours = String(expected.getHours()).padStart(2, '0');
  const minutes = String(expected.getMinutes()).padStart(2, '0');
  expect(formatClockTime(timestamp)).toBe(`${hours}:${minutes}`);
});

it('computes whole days between two date-only strings', () => {
  expect(daysBetween('2026-07-21', '2026-07-21')).toBe(0);
  expect(daysBetween('2026-07-21', '2026-07-24')).toBe(3);
  expect(daysBetween('2026-07-24', '2026-07-21')).toBe(-3);
});

it('labels today, tomorrow, and yesterday', () => {
  expect(relativeDayLabel('2026-07-21', '2026-07-21')).toBe('Today');
  expect(relativeDayLabel('2026-07-22', '2026-07-21')).toBe('Tomorrow');
  expect(relativeDayLabel('2026-07-20', '2026-07-21')).toBe('Yesterday');
});

it('labels near dates relatively and falls back to a weekday date beyond a week', () => {
  expect(relativeDayLabel('2026-07-24', '2026-07-21')).toBe('In 3 days');
  expect(relativeDayLabel('2026-07-18', '2026-07-21')).toBe('3 days ago');
  expect(relativeDayLabel('2026-07-30', '2026-07-21')).toBe(formatWeekdayDate('2026-07-30'));
  expect(relativeDayLabel('2026-07-10', '2026-07-21')).toBe(formatWeekdayDate('2026-07-10'));
});

it('formats the relative age of a timestamp for cache-staleness lines', () => {
  const now = new Date('2026-07-21T12:00:00.000Z');
  expect(formatUpdatedAgo('2026-07-21T11:59:30.000Z', now)).toBe('just now');
  expect(formatUpdatedAgo('2026-07-21T11:55:00.000Z', now)).toBe('5m ago');
  expect(formatUpdatedAgo('2026-07-21T10:00:00.000Z', now)).toBe('2h ago');
  expect(formatUpdatedAgo('2026-07-20T12:00:00.000Z', now)).toBe('1d ago');
  expect(formatUpdatedAgo('2026-07-13T12:00:00.000Z', now)).toBe(`on ${formatDayMonth('2026-07-13T12:00:00.000Z')}`);
});

it('falls back to a neutral label for an unparsable timestamp', () => {
  expect(formatUpdatedAgo('not a timestamp', new Date('2026-07-21T12:00:00.000Z'))).toBe('recently');
});
