import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockParser } from '../parser/mockParser';
import { createInMemoryStorageAdapter } from '../storage/inMemoryAdapter';
import type { StorageAdapter } from '../storage/StorageAdapter';
import { createAgymStore } from './store';

function stubIds(prefix: string) {
  let index = 0;
  Object.defineProperty(globalThis, 'crypto', {
    value: { randomUUID: () => `${prefix}-${++index}` },
    configurable: true,
  });
}

function createTestStore(adapter: StorageAdapter = createInMemoryStorageAdapter()) {
  return createAgymStore({ adapter, parser: mockParser });
}

describe('Agym Zustand store', () => {
  beforeEach(() => {
    vi.useRealTimers();
    stubIds('store-test');
  });

  it('hydrate loads persisted data and flips ui.hydrated true', async () => {
    const adapter = createInMemoryStorageAdapter();
    const rawLog = {
      id: 'raw-existing',
      text: 'existing note',
      loggedAt: '2026-07-11T12:00:00.000Z',
      defaultDate: '2026-07-11',
      source: 'manual' as const,
      schemaVersion: 1 as const,
    };
    const parsed = await mockParser.parse({ text: 'existing note', defaultDate: '2026-07-11', rawLogId: rawLog.id });
    const event = {
      ...parsed.events[0],
      confirmedAt: '2026-07-11T12:05:00.000Z',
      editedByUser: false,
      provenance: 'user_confirmed' as const,
      originalPayload: parsed.events[0].payload,
    };

    await adapter.saveRawLog(rawLog);
    await adapter.saveEvents([event]);

    const store = createTestStore(adapter);
    await store.getState().hydrate();

    expect(store.getState().rawLogs).toEqual([rawLog]);
    expect(store.getState().events).toEqual([event]);
    expect(store.getState().ui.hydrated).toBe(true);
  });

  it('submitLog persists a RawLog and populates drafts via the mock parser', async () => {
    const adapter = createInMemoryStorageAdapter();
    const store = createTestStore(adapter);

    await store.getState().submitLog('Squat 3x8@80kg; knee hurt 3/10', '2026-07-11');

    const state = store.getState();
    expect(state.rawLogs).toHaveLength(1);
    expect(state.rawLogs[0]).toMatchObject({ text: 'Squat 3x8@80kg; knee hurt 3/10', defaultDate: '2026-07-11' });
    expect(state.drafts.map((draft) => draft.payload.kind)).toEqual(['workout', 'pain']);

    await expect(adapter.loadAll()).resolves.toMatchObject({ rawLogs: [state.rawLogs[0]], events: [] });
  });

  it('confirmDraft persists a canonical event retrievable after a fresh hydrate', async () => {
    const adapter = createInMemoryStorageAdapter();
    const store = createTestStore(adapter);

    await store.getState().submitLog('bench 3x5 @ 60kg', '2026-07-11');
    const draftId = store.getState().drafts[0].id;
    await store.getState().confirmDraft(draftId);

    expect(store.getState().drafts).toEqual([]);
    expect(store.getState().events).toHaveLength(1);
    expect(store.getState().events[0]).toMatchObject({ editedByUser: false, provenance: 'user_confirmed' });

    const freshStore = createTestStore(adapter);
    await freshStore.getState().hydrate();

    expect(freshStore.getState().events).toEqual(store.getState().events);
  });

  it('sets editedByUser false when the draft was not modified before confirm', async () => {
    const store = createTestStore();

    await store.getState().submitLog('lunch: chicken rice bowl, 750 kcal', '2026-07-11');
    await store.getState().confirmDraft(store.getState().drafts[0].id);

    expect(store.getState().events[0].editedByUser).toBe(false);
    expect(store.getState().events[0].originalPayload).toEqual(store.getState().events[0].payload);
  });

  it('sets editedByUser true and preserves originalPayload when payload/date/time changed before confirm', async () => {
    const store = createTestStore();

    await store.getState().submitLog('lunch: chicken rice bowl, 750 kcal', '2026-07-11');
    const originalDraft = store.getState().drafts[0];

    store.getState().updateDraft(originalDraft.id, { date: '2026-07-10', time: '13:00' });
    store.getState().updateDraftPayload(originalDraft.id, {
      kind: 'meal',
      description: 'chicken rice bowl plus yogurt',
      kcal: 900,
      proteinG: 55,
    });

    await store.getState().confirmDraft(originalDraft.id);

    const event = store.getState().events[0];
    expect(event.editedByUser).toBe(true);
    expect(event.date).toBe('2026-07-10');
    expect(event.time).toBe('13:00');
    expect(event.originalPayload).toEqual(originalDraft.payload);
    expect(event.payload).not.toEqual(originalDraft.payload);
  });

  it('confirmAll, discardDraft, discardAll, deleteEvent, and deleteAll update state and storage', async () => {
    const adapter = createInMemoryStorageAdapter();
    const store = createTestStore(adapter);

    await store.getState().submitLog('Squat 3x8@80kg; bench 3x5 @ 60kg', '2026-07-11');
    const [discardedDraft, confirmedDraft] = store.getState().drafts;

    store.getState().discardDraft(discardedDraft.id);
    expect(store.getState().drafts.map((draft) => draft.id)).toEqual([confirmedDraft.id]);

    await store.getState().confirmAll();
    expect(store.getState().drafts).toEqual([]);
    expect(store.getState().events.map((event) => event.id)).toEqual([confirmedDraft.id]);

    await store.getState().submitLog('sleep 7h good', '2026-07-11');
    expect(store.getState().drafts).toHaveLength(1);
    store.getState().discardAll();
    expect(store.getState().drafts).toEqual([]);

    await store.getState().deleteEvent(confirmedDraft.id);
    expect(store.getState().events).toEqual([]);
    await expect(adapter.loadAll()).resolves.toMatchObject({ events: [] });

    await store.getState().submitLog('bodyweight 82kg', '2026-07-11');
    await store.getState().confirmAll();
    await store.getState().deleteAll();

    expect(store.getState().rawLogs).toEqual([]);
    expect(store.getState().drafts).toEqual([]);
    expect(store.getState().events).toEqual([]);
    await expect(adapter.loadAll()).resolves.toEqual({ rawLogs: [], events: [] });
  });
});
