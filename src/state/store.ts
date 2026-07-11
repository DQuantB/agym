import { create, type UseBoundStore, type StoreApi } from 'zustand';
import { newId } from '../domain/ids';
import type { CanonicalEvent, DraftEvent, EventPayload, RawLog, Tab } from '../domain/types';
import type { Parser } from '../parser/Parser';
import { mockParser } from '../parser/mockParser';
import { createInMemoryStorageAdapter } from '../storage/inMemoryAdapter';
import type { StorageAdapter } from '../storage/StorageAdapter';

export interface AgymStoreUi {
  activeTab: Tab;
  hydrated: boolean;
  lastMessage: string | null;
}

export interface AgymStore {
  rawLogs: RawLog[];
  drafts: DraftEvent[];
  events: CanonicalEvent[];
  ui: AgymStoreUi;
  adapter: StorageAdapter;
  setAdapter(adapter: StorageAdapter): void;
  setTab(tab: Tab): void;
  hydrate(): Promise<void>;
  submitLog(text: string, defaultDate: string): Promise<void>;
  updateDraft(id: string, patch: Partial<DraftEvent>): void;
  updateDraftPayload(id: string, payload: EventPayload): void;
  confirmDraft(id: string): Promise<void>;
  confirmAll(): Promise<void>;
  discardDraft(id: string): void;
  discardAll(): void;
  deleteEvent(id: string): Promise<void>;
  deleteAll(): Promise<void>;
}

export interface CreateAgymStoreOptions {
  adapter: StorageAdapter;
  parser: Parser;
}

type AgymStoreHook = UseBoundStore<StoreApi<AgymStore>>;

function cloneDraft(draft: DraftEvent): DraftEvent {
  return structuredClone(draft);
}

function draftWasEdited(original: DraftEvent | undefined, current: DraftEvent): boolean {
  if (!original) return false;

  return JSON.stringify({ date: original.date, time: original.time, payload: original.payload }) !== JSON.stringify({ date: current.date, time: current.time, payload: current.payload });
}

function maybeRequestPersistentStorage(): void {
  if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
    void navigator.storage.persist();
  }
}

export function createAgymStore({ adapter: initialAdapter, parser }: CreateAgymStoreOptions): AgymStoreHook {
  const originalDrafts = new Map<string, DraftEvent>();

  return create<AgymStore>((set, get) => ({
    rawLogs: [],
    drafts: [],
    events: [],
    ui: { activeTab: 'log', hydrated: false, lastMessage: null },
    adapter: initialAdapter,

    setAdapter(adapter) {
      set({ adapter });
    },

    setTab(activeTab) {
      set((state) => ({ ui: { ...state.ui, activeTab } }));
    },

    async hydrate() {
      maybeRequestPersistentStorage();
      const data = await get().adapter.loadAll();
      set((state) => ({ ...data, ui: { ...state.ui, hydrated: true } }));
    },

    async submitLog(text, defaultDate) {
      const trimmed = text.trim();
      if (!trimmed) return;

      const log: RawLog = {
        id: newId('raw'),
        text,
        loggedAt: new Date().toISOString(),
        defaultDate,
        source: 'manual',
        schemaVersion: 1,
      };

      await get().adapter.saveRawLog(log);
      const parsed = await parser.parse({ text, defaultDate, rawLogId: log.id });

      originalDrafts.clear();
      for (const draft of parsed.events) {
        originalDrafts.set(draft.id, cloneDraft(draft));
      }

      set((state) => ({
        rawLogs: [...state.rawLogs.filter((existing) => existing.id !== log.id), log],
        drafts: parsed.events,
        ui: {
          ...state.ui,
          lastMessage: `Parsed ${parsed.events.length} draft event(s). Review before confirming.`,
        },
      }));
    },

    updateDraft(id, patch) {
      set((state) => ({
        drafts: state.drafts.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft)),
      }));
    },

    updateDraftPayload(id, payload) {
      set((state) => ({
        drafts: state.drafts.map((draft) =>
          draft.id === id
            ? {
                ...draft,
                payload,
                uncertaintyFlags: draft.uncertaintyFlags.filter((flag) => !flag.field.startsWith('payload')),
              }
            : draft,
        ),
      }));
    },

    async confirmDraft(id) {
      const draft = get().drafts.find((candidate) => candidate.id === id);
      if (!draft) return;

      const originalDraft = originalDrafts.get(id);
      const event: CanonicalEvent = {
        ...draft,
        confirmedAt: new Date().toISOString(),
        editedByUser: draftWasEdited(originalDraft, draft),
        provenance: 'user_confirmed',
        originalPayload: originalDraft?.payload ?? draft.payload,
      };

      await get().adapter.saveEvents([event]);
      originalDrafts.delete(id);

      set((state) => ({
        events: [...state.events.filter((existing) => existing.id !== event.id), event],
        drafts: state.drafts.filter((candidate) => candidate.id !== id),
        ui: { ...state.ui, lastMessage: 'Canonical event saved locally.' },
      }));
    },

    async confirmAll() {
      for (const draft of [...get().drafts]) {
        await get().confirmDraft(draft.id);
      }
    },

    discardDraft(id) {
      originalDrafts.delete(id);
      set((state) => ({ drafts: state.drafts.filter((draft) => draft.id !== id) }));
    },

    discardAll() {
      originalDrafts.clear();
      set({ drafts: [] });
    },

    async deleteEvent(id) {
      await get().adapter.deleteEvent(id);
      set((state) => ({ events: state.events.filter((event) => event.id !== id) }));
    },

    async deleteAll() {
      await get().adapter.deleteAll();
      originalDrafts.clear();
      set((state) => ({
        rawLogs: [],
        drafts: [],
        events: [],
        ui: { ...state.ui, lastMessage: 'All local AGym data deleted.' },
      }));
    },
  }));
}

export let useAgymStore = createAgymStore({
  adapter: createInMemoryStorageAdapter(),
  parser: mockParser,
});

export function initializeAgymStore(options: CreateAgymStoreOptions): AgymStoreHook {
  useAgymStore = createAgymStore(options);
  return useAgymStore;
}
