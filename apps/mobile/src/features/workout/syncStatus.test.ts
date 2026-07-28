import { expect, it } from 'vitest';

import { describeSyncState } from './syncStatus';

it('describes each local sync state with a distinct glyph, tone, and accessibility label', () => {
  expect(describeSyncState('saved_locally')).toMatchObject({ label: 'Saved locally', tone: 'neutral', canRetry: false });
  expect(describeSyncState('syncing')).toMatchObject({ label: 'Syncing…', tone: 'proposal', canRetry: false });
  expect(describeSyncState('synced')).toMatchObject({ label: 'Synced', tone: 'confirmed', canRetry: false });
});

it('states plainly that a failed sync leaves data saved locally and unreadable by a connected LLM', () => {
  const badge = describeSyncState('sync_failed');
  expect(badge.canRetry).toBe(true);
  expect(badge.detail).toContain('Saved locally');
  expect(badge.detail).toContain('A connected LLM cannot read this session until sync succeeds');
  expect(badge.accessibilityLabel).toContain('Retry available');
});

it('folds the last sync error into the failure detail and label when present', () => {
  const badge = describeSyncState('sync_failed', 'Network unavailable');
  expect(badge.detail).toContain('Network unavailable');
  expect(badge.accessibilityLabel).toContain('Network unavailable');
});
