import { localDatabase } from './localDatabase';

// Bump whenever a cached payload's shape changes. Old rows become invisible
// (filtered out in SQL) rather than crashing a screen on a stale shape, and
// get overwritten by the next successful refresh — no explicit purge needed
// since user_id + cache_key is still the primary key.
export const CACHE_SCHEMA_VERSION = 1;

export type CachedRow = { payload: string; updatedAt: string };

// This module deals only in raw strings — typed payload shapes, zod
// validation, and the date/Map serialization rules live in the per-feature
// cache modules (todayCache.ts, plansCache.ts) that call this one.

export async function readCacheRow(userId: string, cacheKey: string): Promise<CachedRow | null> {
  try {
    const db = await localDatabase();
    const row = await db.getFirstAsync<{ payload: string; updated_at: string }>(
      'SELECT payload, updated_at FROM screen_cache WHERE user_id = ? AND cache_key = ? AND schema_version = ?',
      userId,
      cacheKey,
      CACHE_SCHEMA_VERSION,
    );
    return row ? { payload: row.payload, updatedAt: row.updated_at } : null;
  } catch {
    // A corrupt local DB must never throw into a screen — worst case is a
    // cache miss, which is today's exact behaviour.
    return null;
  }
}

export async function writeCacheRow(userId: string, cacheKey: string, payload: string): Promise<void> {
  const db = await localDatabase();
  await db.runAsync(
    `INSERT INTO screen_cache (user_id, cache_key, schema_version, payload, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, cache_key) DO UPDATE SET schema_version = excluded.schema_version, payload = excluded.payload, updated_at = excluded.updated_at`,
    userId,
    cacheKey,
    CACHE_SCHEMA_VERSION,
    payload,
    new Date().toISOString(),
  );
}

export async function clearAccountScreenCache(userId: string): Promise<void> {
  const db = await localDatabase();
  await db.runAsync('DELETE FROM screen_cache WHERE user_id = ?', userId);
}
