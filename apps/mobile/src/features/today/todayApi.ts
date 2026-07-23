import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import type { TodayExecution, TodayPlan } from './todayState';

const gymPlanSchema = z.object({
  kind: z.literal('gym_workout'),
  schema_version: z.literal(1),
  scheduled_for: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().trim().min(1).max(160),
  exercises: z.array(z.object({
    client_id: z.string().trim().min(1).max(100),
    name: z.string().trim().min(1).max(120),
    sets: z.array(z.object({ reps: z.number().int().min(1).max(100) })).min(1).max(20),
  })).min(1).max(30),
});

const planRowSchema = z.object({ id: z.string().uuid(), plan_data: gymPlanSchema, scheduled_for: z.string() });
const executionRowSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['in_progress', 'completed']),
  completed_at: z.string().nullable(),
});

export type TodayRemoteData = { activePlan: TodayPlan | null; execution: TodayExecution | null; proposal: TodayPlan | null };

function toTodayPlan(row: unknown): TodayPlan | null {
  const parsed = planRowSchema.safeParse(row);
  if (!parsed.success) return null;
  return { id: parsed.data.id, title: parsed.data.plan_data.title, scheduledFor: parsed.data.scheduled_for };
}

function fail(error: { message: string } | null, action: string): never {
  throw new Error(`AGYM could not ${action}: ${error?.message ?? 'no data returned.'}`);
}

async function loadPlanByStatus(client: SupabaseClient, date: string, status: 'active' | 'proposed'): Promise<TodayPlan | null> {
  const { data, error } = await client
    .from('plans')
    .select('id, plan_data, scheduled_for')
    .eq('scheduled_for', date)
    .eq('status', status)
    .eq('plan_data->>kind', 'gym_workout')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) fail(error, `load today's ${status} workout`);
  return toTodayPlan(data);
}

export async function loadTodayRemoteData(client: SupabaseClient, date: string): Promise<TodayRemoteData> {
  const [activePlan, proposal] = await Promise.all([
    loadPlanByStatus(client, date, 'active'),
    loadPlanByStatus(client, date, 'proposed'),
  ]);

  if (!activePlan) return { activePlan: null, execution: null, proposal };
  const { data, error } = await client
    .from('workout_executions')
    .select('id, status, completed_at')
    .eq('plan_id', activePlan.id)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) fail(error, "load today's workout progress");

  const parsedExecution = executionRowSchema.safeParse(data);
  const execution = parsedExecution.success
    ? { id: parsedExecution.data.id, status: parsedExecution.data.status, completedAt: parsedExecution.data.completed_at }
    : null;
  return { activePlan, execution, proposal };
}
