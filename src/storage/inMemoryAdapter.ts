import { ExportSchema } from '../domain/schemas';
import type { AgymExport, CanonicalEvent, RawLog } from '../domain/types';
import type { StorageAdapter } from './StorageAdapter';

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function createInMemoryStorageAdapter(): StorageAdapter {
  let rawLogs: RawLog[] = [];
  let events: CanonicalEvent[] = [];

  return {
    async loadAll() {
      return { rawLogs: clone(rawLogs), events: clone(events) };
    },

    async saveRawLog(log) {
      rawLogs = [...rawLogs.filter((existing) => existing.id !== log.id), clone(log)];
    },

    async saveEvents(nextEvents) {
      const eventsById = new Map(events.map((event) => [event.id, event]));
      for (const event of nextEvents) {
        eventsById.set(event.id, clone(event));
      }
      events = [...eventsById.values()];
    },

    async deleteEvent(id) {
      events = events.filter((event) => event.id !== id);
    },

    async exportAll() {
      const payload: AgymExport = ExportSchema.parse({
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        rawLogs,
        events,
      });

      return JSON.stringify(payload, null, 2);
    },

    async deleteAll() {
      rawLogs = [];
      events = [];
    },
  };
}
