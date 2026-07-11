import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExportSchema } from '../domain/schemas';
import { makeCanonicalEvent, makeRawLog } from '../test/factories';
import { runAdapterContract } from './adapterContract.test';
import { localStorageAdapter, localStorageKeys } from './localStorageAdapter';

runAdapterContract('localStorageAdapter', () => {
  localStorage.clear();
  return localStorageAdapter;
});

describe('localStorageAdapter validation and quarantine', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('keeps valid siblings while quarantining hand-corrupted records with a warning', async () => {
    const validRawLog = makeRawLog({ id: 'valid-raw' });
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    localStorage.setItem(localStorageKeys.RAW, JSON.stringify([validRawLog, { id: '', bad: true }]));

    const all = await localStorageAdapter.loadAll();

    expect(all.rawLogs).toEqual([validRawLog]);
    expect(warning).toHaveBeenCalledWith(expect.stringContaining('Quarantined invalid data'));

    const quarantine = JSON.parse(localStorage.getItem(localStorageKeys.QUARANTINE) ?? '[]');
    expect(quarantine).toEqual([
      expect.objectContaining({
        key: localStorageKeys.RAW,
        reason: expect.any(String),
        value: { id: '', bad: true },
        quarantinedAt: expect.any(String),
      }),
    ]);
  });

  it('handles corrupt JSON at a storage key without crashing', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    localStorage.setItem(localStorageKeys.EVENTS, '{not valid json');

    await expect(localStorageAdapter.loadAll()).resolves.toEqual({ rawLogs: [], events: [] });
    expect(warning).toHaveBeenCalledWith(expect.stringContaining('Quarantined invalid data'));

    const quarantine = JSON.parse(localStorage.getItem(localStorageKeys.QUARANTINE) ?? '[]');
    expect(quarantine).toEqual([
      expect.objectContaining({
        key: localStorageKeys.EVENTS,
        value: '{not valid json',
      }),
    ]);
  });

  it('quarantines non-array JSON instead of crashing or dropping sibling keys', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const validEvent = makeCanonicalEvent({ id: 'valid-event' });
    localStorage.setItem(localStorageKeys.RAW, JSON.stringify({ records: [] }));
    localStorage.setItem(localStorageKeys.EVENTS, JSON.stringify([validEvent]));

    const all = await localStorageAdapter.loadAll();

    expect(all).toEqual({ rawLogs: [], events: [validEvent] });
    const quarantine = JSON.parse(localStorage.getItem(localStorageKeys.QUARANTINE) ?? '[]');
    expect(quarantine).toEqual([
      expect.objectContaining({
        key: localStorageKeys.RAW,
        reason: 'Expected a JSON array',
        value: { records: [] },
      }),
    ]);
  });

  it('deleteAll clears every agym.* key including quarantine and future migration keys', async () => {
    localStorage.setItem(localStorageKeys.RAW, JSON.stringify([makeRawLog()]));
    localStorage.setItem(localStorageKeys.EVENTS, JSON.stringify([makeCanonicalEvent()]));
    localStorage.setItem(localStorageKeys.QUARANTINE, JSON.stringify([{ bad: true }]));
    localStorage.setItem('agym.v2.future', 'future value');
    localStorage.setItem('unrelated.key', 'keep me');

    await localStorageAdapter.deleteAll();

    expect(localStorage.getItem(localStorageKeys.RAW)).toBeNull();
    expect(localStorage.getItem(localStorageKeys.EVENTS)).toBeNull();
    expect(localStorage.getItem(localStorageKeys.QUARANTINE)).toBeNull();
    expect(localStorage.getItem('agym.v2.future')).toBeNull();
    expect(localStorage.getItem('unrelated.key')).toBe('keep me');
  });

  it('exportAll returns pretty JSON with schemaVersion, exportedAt, rawLogs, and events', async () => {
    const rawLog = makeRawLog();
    const event = makeCanonicalEvent();

    await localStorageAdapter.saveRawLog(rawLog);
    await localStorageAdapter.saveEvents([event]);

    const exported = await localStorageAdapter.exportAll();
    expect(exported).toContain('\n  "schemaVersion": 1,');
    expect(exported).toContain('\n  "exportedAt":');
    expect(exported).toContain('\n  "rawLogs":');
    expect(exported).toContain('\n  "events":');

    expect(ExportSchema.parse(JSON.parse(exported))).toEqual({
      schemaVersion: 1,
      exportedAt: expect.any(String),
      rawLogs: [rawLog],
      events: [event],
    });
  });
});
