import { expect, it } from 'vitest';

import { resolveCacheFreshness } from './cacheFreshness';

const now = new Date('2026-07-21T12:00:00.000Z');

it('is fresh when there is no cache at all', () => {
  expect(resolveCacheFreshness({ cacheUpdatedAt: null, refreshSucceeded: false, refreshFailed: false, now })).toEqual({ kind: 'fresh' });
});

it('is stale when serving cache and the refresh has neither succeeded nor failed yet', () => {
  const result = resolveCacheFreshness({ cacheUpdatedAt: '2026-07-21T10:00:00.000Z', refreshSucceeded: false, refreshFailed: false, now });
  expect(result).toEqual({ kind: 'stale', label: '2h ago' });
});

it('escalates to stale_failed when the refresh fails while serving cache', () => {
  const result = resolveCacheFreshness({ cacheUpdatedAt: '2026-07-21T10:00:00.000Z', refreshSucceeded: false, refreshFailed: true, now });
  expect(result).toEqual({ kind: 'stale_failed', label: '2h ago' });
});

it('is fresh once the refresh succeeds, even with a cache present', () => {
  const result = resolveCacheFreshness({ cacheUpdatedAt: '2026-07-21T10:00:00.000Z', refreshSucceeded: true, refreshFailed: false, now });
  expect(result).toEqual({ kind: 'fresh' });
});

it('lets a successful refresh win even if a later failure flag is also set', () => {
  const result = resolveCacheFreshness({ cacheUpdatedAt: '2026-07-21T10:00:00.000Z', refreshSucceeded: true, refreshFailed: true, now });
  expect(result).toEqual({ kind: 'fresh' });
});
