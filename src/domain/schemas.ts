import { z } from 'zod';

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const timeSchema = z.string().regex(/^\d{2}:\d{2}$/).nullable();

export const RawLogSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  loggedAt: z.string().datetime(),
  defaultDate: dateSchema,
  source: z.literal('manual'),
  schemaVersion: z.literal(1),
});

export const UncertaintyFlagSchema = z.object({ field: z.string().min(1), reason: z.string().min(1) });
export const SetSchema = z.object({ reps: z.number().int().positive().nullable(), weightKg: z.number().positive().nullable(), rpe: z.number().min(1).max(10).nullable() });
export const WorkoutPayloadSchema = z.object({ kind: z.literal('workout'), exercises: z.array(z.object({ name: z.string().min(1), sets: z.array(SetSchema) })), durationMin: z.number().positive().nullable(), notes: z.string().nullable() });
export const MealPayloadSchema = z.object({ kind: z.literal('meal'), description: z.string().min(1), kcal: z.number().positive().nullable(), proteinG: z.number().positive().nullable() });
export const BodyweightPayloadSchema = z.object({ kind: z.literal('bodyweight'), weightKg: z.number().positive() });
export const SleepPayloadSchema = z.object({ kind: z.literal('sleep'), durationH: z.number().positive().nullable(), quality: z.enum(['poor','ok','good']).nullable() });
export const PainPayloadSchema = z.object({ kind: z.literal('pain'), bodyPart: z.string().nullable(), description: z.string().min(1), severity: z.number().int().min(1).max(10).nullable(), notes: z.string().nullable() });
export const NotePayloadSchema = z.object({ kind: z.literal('note'), text: z.string().min(1) });

export const EventPayloadSchema = z.discriminatedUnion('kind', [WorkoutPayloadSchema, MealPayloadSchema, BodyweightPayloadSchema, SleepPayloadSchema, PainPayloadSchema, NotePayloadSchema]);

export const DraftEventSchema = z.object({
  id: z.string().min(1), rawLogId: z.string().min(1), date: dateSchema, time: timeSchema,
  payload: EventPayloadSchema, uncertaintyFlags: z.array(UncertaintyFlagSchema), sourceText: z.string().min(1), parserVersion: z.string().min(1), schemaVersion: z.literal(1),
});
export const CanonicalEventSchema = DraftEventSchema.extend({ confirmedAt: z.string().datetime(), editedByUser: z.boolean(), provenance: z.literal('user_confirmed'), originalPayload: EventPayloadSchema });
export const ExportSchema = z.object({ schemaVersion: z.literal(1), exportedAt: z.string().datetime(), rawLogs: z.array(RawLogSchema), events: z.array(CanonicalEventSchema) });
