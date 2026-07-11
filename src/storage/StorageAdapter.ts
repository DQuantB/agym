import type { CanonicalEvent, RawLog } from '../domain/types';
export interface StorageAdapter { loadAll(): Promise<{ rawLogs: RawLog[]; events: CanonicalEvent[] }>; saveRawLog(log: RawLog): Promise<void>; saveEvents(events: CanonicalEvent[]): Promise<void>; deleteEvent(id: string): Promise<void>; exportAll(): Promise<string>; deleteAll(): Promise<void>; }
