import type { CanonicalEvent, RawLog } from '../domain/types';

export interface PersistedStorageSnapshotV1 {
  schemaVersion: 1;
  rawLogs: RawLog[];
  events: CanonicalEvent[];
}

export type PersistedStorageSnapshot = PersistedStorageSnapshotV1;

export function migrateStorageSnapshot(snapshot: PersistedStorageSnapshot): PersistedStorageSnapshotV1 {
  switch (snapshot.schemaVersion) {
    case 1:
      return snapshot;
  }
}
