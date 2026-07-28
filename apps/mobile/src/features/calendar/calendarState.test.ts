import { expect, it } from 'vitest';

import { mapCalendarScreenState } from './calendarState';

const defaults = {
  configured: true,
  authenticated: true,
  loading: false,
  error: null,
  proposals: [],
  scheduled: [],
};

it('keeps Plans gated until configuration and authenticated session are ready', () => {
  expect(mapCalendarScreenState({ ...defaults, configured: false })).toEqual({ kind: 'unconfigured' });
  expect(mapCalendarScreenState({ ...defaults, authenticated: false })).toEqual({ kind: 'signed_out' });
});

it('does not expose empty Plans state while the authenticated query is loading', () => {
  expect(mapCalendarScreenState({ ...defaults, loading: true })).toEqual({ kind: 'loading' });
});

it('maps remote failure and loaded plan states distinctly', () => {
  expect(mapCalendarScreenState({ ...defaults, error: 'Network unavailable' })).toEqual({ kind: 'error', message: 'Network unavailable' });
  expect(mapCalendarScreenState(defaults)).toEqual({ kind: 'loaded', proposals: [], scheduled: [] });
});
