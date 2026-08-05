import { z } from 'zod';

import type { TodayRemoteData } from './todayApi';
import type { TodayPlan } from './todayState';

export type TodayCachePayload = {
  date: string; // local date this snapshot describes — see parseTodayCache
  remote: TodayRemoteData;
  upcomingPlans: TodayPlan[];
};

// These validate the mapped cache shape, not DB rows — todayApi's
// planRowSchema/executionRowSchema are snake_case row schemas and don't
// apply here. Values already passed remote validation once when they were
// first fetched, so we check shape, not exact string formats (no .uuid()).
const todayPlanSchema = z.object({ id: z.string(), title: z.string(), scheduledFor: z.string() });
const todayExecutionSchema = z.object({
  id: z.string(),
  status: z.enum(['in_progress', 'completed']),
  completedAt: z.string().nullable(),
});
const payloadSchema = z.object({
  date: z.string(),
  remote: z.object({
    activePlan: todayPlanSchema.nullable(),
    execution: todayExecutionSchema.nullable(),
    proposal: todayPlanSchema.nullable(),
  }),
  upcomingPlans: z.array(todayPlanSchema),
});

export function serializeTodayCache(payload: TodayCachePayload): string {
  return JSON.stringify(payload);
}

/**
 * `remote` (today's active plan / execution / proposal) is day-specific —
 * replaying yesterday's snapshot could show "workout in progress" or
 * "confirmed" for the wrong day. `upcomingPlans` is a date-keyed list and
 * isn't day-specific, so on a date mismatch (e.g. offline past midnight) we
 * drop `remote` but keep `upcomingPlans` — the week strip still renders.
 */
export function parseTodayCache(raw: string, todayDate: string): TodayCachePayload | null {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = payloadSchema.safeParse(parsedJson);
  if (!result.success) return null;
  const payload = result.data;
  if (payload.date !== todayDate) {
    return { date: todayDate, remote: { activePlan: null, execution: null, proposal: null }, upcomingPlans: payload.upcomingPlans };
  }
  return payload;
}
