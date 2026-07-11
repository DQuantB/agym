import { CanonicalEventSchema, ExportSchema, RawLogSchema } from '../domain/schemas';
import type { StorageAdapter } from './StorageAdapter';
const RAW='agym.v1.rawLogs'; const EVENTS='agym.v1.events'; const QUAR='agym.v1.quarantine';
function readArray<T>(key: string, schema: { safeParse: (x: unknown) => { success: true; data: T } | { success: false } }): T[] { const raw = localStorage.getItem(key); if (!raw) return []; const arr: unknown = JSON.parse(raw); if (!Array.isArray(arr)) return []; const valid:T[]=[]; const bad:unknown[]=[]; for (const item of arr) { const res=schema.safeParse(item); if (res.success) valid.push(res.data); else bad.push(item); } if (bad.length) localStorage.setItem(QUAR, JSON.stringify({ quarantinedAt: new Date().toISOString(), [key]: bad })); return valid; }
export const localStorageAdapter: StorageAdapter = {
 async loadAll(){ return { rawLogs: readArray(RAW, RawLogSchema), events: readArray(EVENTS, CanonicalEventSchema) }; },
 async saveRawLog(log){ const logs=readArray(RAW, RawLogSchema).filter(l=>l.id!==log.id); logs.push(log); localStorage.setItem(RAW, JSON.stringify(logs)); },
 async saveEvents(events){ const existing=readArray(EVENTS, CanonicalEventSchema); const byId=new Map(existing.map(e=>[e.id,e])); for (const e of events) byId.set(e.id,e); localStorage.setItem(EVENTS, JSON.stringify([...byId.values()])); },
 async deleteEvent(id){ localStorage.setItem(EVENTS, JSON.stringify(readArray(EVENTS, CanonicalEventSchema).filter(e=>e.id!==id))); },
 async exportAll(){ const payload={ schemaVersion:1 as const, exportedAt:new Date().toISOString(), ...(await this.loadAll()) }; return JSON.stringify(ExportSchema.parse(payload), null, 2); },
 async deleteAll(){ localStorage.removeItem(RAW); localStorage.removeItem(EVENTS); localStorage.removeItem(QUAR); }
};
export const localStorageKeys = { RAW, EVENTS, QUAR };
