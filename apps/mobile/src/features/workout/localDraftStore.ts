import * as SQLite from 'expo-sqlite';

export type LocalSyncState = 'saved_locally' | 'syncing' | 'synced' | 'sync_failed';

export type LocalExecutionDraft = {
  userId: string;
  planId: string;
  executionId: string | null;
  plannedSnapshot: unknown;
  actualData: unknown;
  additionalNotes: string;
  syncState: LocalSyncState;
  lastSyncError: string | null;
  updatedAt: string;
};

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function database() {
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
      `);
      return db;
    });
  }
  return databasePromise;
}

export async function saveLocalExecutionDraft(draft: LocalExecutionDraft): Promise<void> {
  const db = await database();
  await db.runAsync(
    `INSERT INTO workout_drafts (user_id, plan_id, payload, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, plan_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
    draft.userId,
    draft.planId,
    JSON.stringify(draft),
    draft.updatedAt,
  );
}

export async function loadLocalExecutionDraft(userId: string, planId: string): Promise<LocalExecutionDraft | null> {
  const db = await database();
  const row = await db.getFirstAsync<{ payload: string }>(
    'SELECT payload FROM workout_drafts WHERE user_id = ? AND plan_id = ?',
    userId,
    planId,
  );
  if (!row) return null;
  try {
    const value = JSON.parse(row.payload) as LocalExecutionDraft;
    if (value.userId !== userId || value.planId !== planId) return null;
    return value;
  } catch {
    return null;
  }
}

export async function deleteLocalExecutionDraft(userId: string, planId: string): Promise<void> {
  const db = await database();
  await db.runAsync('DELETE FROM workout_drafts WHERE user_id = ? AND plan_id = ?', userId, planId);
}

export async function clearAccountLocalExecutionDrafts(userId: string): Promise<void> {
  const db = await database();
  await db.runAsync('DELETE FROM workout_drafts WHERE user_id = ?', userId);
}
