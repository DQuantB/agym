import { z } from 'zod';

import { gymPlanSchema } from '@/features/workout/workoutApi';

import type { CalendarPlan, SupersededPlan } from './calendarApi';

export type PlansCachePayload = {
  proposals: CalendarPlan[];
  scheduled: CalendarPlan[];
  supersededByDate: [string, SupersededPlan][]; // Map serialized as entries — JSON.stringify(new Map()) silently loses data
};

// `gymPlanSchema` is exported by workoutApi.ts and is exactly the shape of
// CalendarPlan['plan'] — reuse it rather than re-declaring it here. These
// values already passed remote validation once, so string fields use
// z.string() rather than stricter format checks like .uuid().
const calendarPlanSchema = z.object({
  id: z.string(),
  status: z.enum(['proposed', 'active']),
  source: z.string(),
  createdAt: z.string(),
  scheduledFor: z.string(),
  plan: gymPlanSchema,
});
const supersededPlanSchema = z.object({ id: z.string(), title: z.string() });
const payloadSchema = z.object({
  proposals: z.array(calendarPlanSchema),
  scheduled: z.array(calendarPlanSchema),
  supersededByDate: z.array(z.tuple([z.string(), supersededPlanSchema])),
});

export function serializePlansCache(payload: {
  proposals: CalendarPlan[];
  scheduled: CalendarPlan[];
  supersededByDate: Map<string, SupersededPlan>;
}): string {
  const raw: PlansCachePayload = {
    proposals: payload.proposals,
    scheduled: payload.scheduled,
    supersededByDate: Array.from(payload.supersededByDate.entries()),
  };
  return JSON.stringify(raw);
}

export type ParsedPlansCache = {
  proposals: CalendarPlan[];
  scheduled: CalendarPlan[];
  supersededByDate: Map<string, SupersededPlan>;
};

export function parsePlansCache(raw: string): ParsedPlansCache | null {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = payloadSchema.safeParse(parsedJson);
  if (!result.success) return null;
  return {
    proposals: result.data.proposals as CalendarPlan[],
    scheduled: result.data.scheduled as CalendarPlan[],
    supersededByDate: new Map(result.data.supersededByDate as [string, SupersededPlan][]),
  };
}

/**
 * `[]` is a legitimate loaded value for proposals/scheduled, so we can't
 * pick cache-vs-live by "is it empty" — that would resurrect a stale cache
 * for a user who genuinely has zero proposals. Key strictly off whether a
 * live refresh has actually landed.
 */
export function resolvePlansView<T>(input: { refreshed: boolean; live: T; cached: T | null }): T {
  return input.refreshed || !input.cached ? input.live : input.cached;
}
