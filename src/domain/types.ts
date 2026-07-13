import type { z } from 'zod';
import type { CanonicalEventSchema, DraftEventSchema, EventPayloadSchema, ExportSchema, RawLogSchema, UncertaintyFlagSchema } from './schemas';
export type RawLog = z.infer<typeof RawLogSchema>;
export type UncertaintyFlag = z.infer<typeof UncertaintyFlagSchema>;
export type EventPayload = z.infer<typeof EventPayloadSchema>;
export type DraftEvent = z.infer<typeof DraftEventSchema>;
export type CanonicalEvent = z.infer<typeof CanonicalEventSchema>;
export type AgymExport = z.infer<typeof ExportSchema>;
export type Tab = 'log' | 'timeline' | 'plans' | 'briefing' | 'data';
