import { expect, it } from 'vitest';

import { fabBottomOffset } from './fabPlacement';

it('clears the tab bar with no home indicator (insetsBottom 0)', () => {
  const offset = fabBottomOffset(0, 56, 16);
  expect(offset).toBeGreaterThan(56);
  expect(offset).toBe(72);
});

it('clears the tab bar with a home indicator inset', () => {
  const offset = fabBottomOffset(34, 56, 16);
  expect(offset).toBeGreaterThan(34 + 56);
  expect(offset).toBe(106);
});

it('grows with the safe-area inset rather than staying fixed', () => {
  expect(fabBottomOffset(34, 56, 16)).toBeGreaterThan(fabBottomOffset(0, 56, 16));
});

it('never goes negative for a malformed negative inset', () => {
  expect(fabBottomOffset(-10, 56, 16)).toBe(72);
});
