import { formatUpdatedAgo } from './dateLabels';

export type CacheFreshness =
  | { kind: 'fresh' }
  | { kind: 'stale'; label: string }
  | { kind: 'stale_failed'; label: string };

/**
 * Drives the muted "Saved data · updated Nm ago" line and the escalated
 * warning card. No cache, or a refresh that has already succeeded, means
 * nothing needs to be said — `fresh` renders nothing, which is how the line
 * disappears the moment fresh data lands. `refreshSucceeded` wins over a
 * later `refreshFailed`: once fresh data is on screen, a subsequent focus
 * failure shouldn't retroactively relabel it stale.
 */
export function resolveCacheFreshness(input: {
  cacheUpdatedAt: string | null;
  refreshSucceeded: boolean;
  refreshFailed: boolean;
  now: Date;
}): CacheFreshness {
  if (!input.cacheUpdatedAt || input.refreshSucceeded) return { kind: 'fresh' };
  const label = formatUpdatedAgo(input.cacheUpdatedAt, input.now);
  return input.refreshFailed ? { kind: 'stale_failed', label } : { kind: 'stale', label };
}
