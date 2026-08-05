import * as SQLite from 'expo-sqlite';

// Single shared handle for all on-device tables. A second openDatabaseAsync
// on the same file would invite SQLITE_BUSY for no benefit, so every local
// store (workout drafts, screen cache, …) goes through this one singleton.
let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function localDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync('agym-local.db').then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS workout_drafts (
          user_id TEXT NOT NULL,
          plan_id TEXT NOT NULL,
          payload TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (user_id, plan_id)
        );
        CREATE TABLE IF NOT EXISTS screen_cache (
          user_id TEXT NOT NULL,
          cache_key TEXT NOT NULL,
          schema_version INTEGER NOT NULL,
          payload TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (user_id, cache_key)
        );
      `);
      return db;
    });
  }
  return databasePromise;
}
