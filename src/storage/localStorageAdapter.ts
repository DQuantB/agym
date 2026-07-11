import type { z } from 'zod';
import { CanonicalEventSchema, ExportSchema, RawLogSchema } from '../domain/schemas';
import type { AgymExport } from '../domain/types';
import type { StorageAdapter } from './StorageAdapter';
import { migrateStorageSnapshot } from './migrations';

const RAW = 'agym.v1.rawLogs';
const EVENTS = 'agym.v1.events';
const QUARANTINE = 'agym.v1.quarantine';
const AGYM_KEY_PREFIX = 'agym.';

interface QuarantineEntry {
  key: string;
  reason: string;
  value: unknown;
  quarantinedAt: string;
}

type ArraySchema<T> = z.ZodType<T>;

function warnQuarantine(entry: QuarantineEntry): void {
  console.warn(`[AGym storage] Quarantined invalid data from ${entry.key}: ${entry.reason}`);
}

function loadQuarantine(): QuarantineEntry[] {
  const raw = localStorage.getItem(QUARANTINE);
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QuarantineEntry[]) : [];
  } catch {
    return [];
  }
}

function quarantine(key: string, reason: string, value: unknown): void {
  const entry: QuarantineEntry = { key, reason, value, quarantinedAt: new Date().toISOString() };
  localStorage.setItem(QUARANTINE, JSON.stringify([...loadQuarantine(), entry], null, 2));
  warnQuarantine(entry);
}

function readArray<T>(key: string, schema: ArraySchema<T>): T[] {
  const raw = localStorage.getItem(key);
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    quarantine(key, error instanceof Error ? error.message : 'Invalid JSON', raw);
    return [];
  }

  if (!Array.isArray(parsed)) {
    quarantine(key, 'Expected a JSON array', parsed);
    return [];
  }

  const valid: T[] = [];
  for (const item of parsed) {
    const result = schema.safeParse(item);
    if (result.success) {
      valid.push(result.data);
    } else {
      quarantine(key, result.error.message, item);
    }
  }

  return valid;
}

function writeArray(key: string, records: unknown[]): void {
  localStorage.setItem(key, JSON.stringify(records));
}

export const localStorageAdapter: StorageAdapter = {
  async loadAll() {
    const snapshot = migrateStorageSnapshot({
      schemaVersion: 1,
      rawLogs: readArray(RAW, RawLogSchema),
      events: readArray(EVENTS, CanonicalEventSchema),
    });

    return { rawLogs: snapshot.rawLogs, events: snapshot.events };
  },

  async saveRawLog(log) {
    const logs = readArray(RAW, RawLogSchema).filter((existing) => existing.id !== log.id);
    writeArray(RAW, [...logs, log]);
  },

  async saveEvents(events) {
    const eventsById = new Map(readArray(EVENTS, CanonicalEventSchema).map((event) => [event.id, event]));
    for (const event of events) {
      eventsById.set(event.id, event);
    }
    writeArray(EVENTS, [...eventsById.values()]);
  },

  async deleteEvent(id) {
    writeArray(
      EVENTS,
      readArray(EVENTS, CanonicalEventSchema).filter((event) => event.id !== id),
    );
  },

  async exportAll() {
    const payload: AgymExport = ExportSchema.parse({
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      ...(await this.loadAll()),
    });

    return JSON.stringify(payload, null, 2);
  },

  async deleteAll() {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(AGYM_KEY_PREFIX)) {
        localStorage.removeItem(key);
      }
    }
  },
};

export const localStorageKeys = { RAW, EVENTS, QUARANTINE };
