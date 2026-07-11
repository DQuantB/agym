import { describe, expect, it } from 'vitest';
import { ExportSchema } from '../domain/schemas';
import type { StorageAdapter } from './StorageAdapter';
import { createInMemoryStorageAdapter } from './inMemoryAdapter';
import { makeCanonicalEvent, makeRawLog } from '../test/factories';

type AdapterFactory = () => StorageAdapter;

export function runAdapterContract(name: string, adapterFactory: AdapterFactory): void {
  describe(`${name} StorageAdapter contract`, () => {
    it('round-trips raw logs and canonical events', async () => {
      const adapter = adapterFactory();
      const rawLog = makeRawLog();
      const event = makeCanonicalEvent();

      await adapter.saveRawLog(rawLog);
      await adapter.saveEvents([event]);

      await expect(adapter.loadAll()).resolves.toEqual({ rawLogs: [rawLog], events: [event] });
    });

    it('upserts raw logs and events by id', async () => {
      const adapter = adapterFactory();
      const originalRawLog = makeRawLog({ id: 'raw-upsert', text: 'before' });
      const updatedRawLog = makeRawLog({ id: 'raw-upsert', text: 'after' });
      const originalEvent = makeCanonicalEvent({ id: 'event-upsert', payload: { kind: 'note', text: 'before' }, originalPayload: { kind: 'note', text: 'before' } });
      const updatedEvent = makeCanonicalEvent({ id: 'event-upsert', payload: { kind: 'note', text: 'after' }, originalPayload: { kind: 'note', text: 'before' }, editedByUser: true });

      await adapter.saveRawLog(originalRawLog);
      await adapter.saveRawLog(updatedRawLog);
      await adapter.saveEvents([originalEvent]);
      await adapter.saveEvents([updatedEvent]);

      const all = await adapter.loadAll();
      expect(all.rawLogs).toEqual([updatedRawLog]);
      expect(all.events).toEqual([updatedEvent]);
    });

    it('deletes a single event without deleting raw logs or other events', async () => {
      const adapter = adapterFactory();
      const rawLog = makeRawLog();
      const deletedEvent = makeCanonicalEvent({ id: 'event-delete' });
      const keptEvent = makeCanonicalEvent({ id: 'event-keep', payload: { kind: 'note', text: 'keep' }, originalPayload: { kind: 'note', text: 'keep' } });

      await adapter.saveRawLog(rawLog);
      await adapter.saveEvents([deletedEvent, keptEvent]);
      await adapter.deleteEvent(deletedEvent.id);

      await expect(adapter.loadAll()).resolves.toEqual({ rawLogs: [rawLog], events: [keptEvent] });
    });

    it('exports the full data shape as pretty validated JSON', async () => {
      const adapter = adapterFactory();
      const rawLog = makeRawLog();
      const event = makeCanonicalEvent();

      await adapter.saveRawLog(rawLog);
      await adapter.saveEvents([event]);

      const exported = await adapter.exportAll();
      expect(exported).toContain('\n  "schemaVersion": 1,');

      const parsed = ExportSchema.parse(JSON.parse(exported));
      expect(parsed.schemaVersion).toBe(1);
      expect(parsed.exportedAt).toEqual(expect.any(String));
      expect(parsed.rawLogs).toEqual([rawLog]);
      expect(parsed.events).toEqual([event]);
    });

    it('deleteAll removes all raw logs and events', async () => {
      const adapter = adapterFactory();

      await adapter.saveRawLog(makeRawLog());
      await adapter.saveEvents([makeCanonicalEvent()]);
      await adapter.deleteAll();

      await expect(adapter.loadAll()).resolves.toEqual({ rawLogs: [], events: [] });
    });
  });
}

runAdapterContract('createInMemoryStorageAdapter', createInMemoryStorageAdapter);
