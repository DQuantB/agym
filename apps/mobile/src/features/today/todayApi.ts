import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { effectiveGymPlan } from '@/features/workout/workoutApi';

import type { TodayExecution, TodayPlan } from './todayState';

const planRowSchema = z.object({ id: z.string().uuid(), plan_data: z.unknown(), user_revision_data: z.unknown().nullable().optional(), scheduled_for: z.string() }).required({ plan_data: true });
const executionRowSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['in_progress', 'completed']),
  completed_at: z.string().nullable(),
});

export type TodayRemoteData = { activePlan: TodayPlan | null; execution: TodayExecution | null; proposal: TodayPlan | null };

function toTodayPlan(row: unknown): TodayPlan | null {
  const parsed = planRowSchema.safeParse(row);
  if (!parsed.success || parsed.data.plan_data === undefined) return null;
  const plan = effectiveGymPlan({ plan_data: parsed.data.plan_data, user_revision_data: parsed.data.user_revision_data });
  return plan ? { id: parsed.data.id, title: plan.title, scheduledFor: parsed.data.scheduled_for } : null;
}

function fail(error: { message: string } | null, action: string): never {
  throw new Error(`AGYM could not ${action}: ${error?.message ?? 'no data returned.'}`);
}

async function loadPlanByStatus(client: SupabaseClient, date: string, status: 'active' | 'proposed'): Promise<TodayPlan | null> {
  const { data, error } = await client
    .from('plans')
    .select('id, plan_data, user_revision_data, scheduled_for')
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

export async function loadUpcomingActivePlans(client: SupabaseClient, fromDate: string, throughDate: string): Promise<TodayPlan[]> {
  const { data, error } = await client
    .from('plans')
    .select('id, plan_data, user_revision_data, scheduled_for')
    .eq('status', 'active')
    .eq('plan_data->>kind', 'gym_workout')
    .gte('scheduled_for', fromDate)
    .lte('scheduled_for', throughDate)
    .is('deleted_at', null)
    .order('scheduled_for', { ascending: true });
  if (error) fail(error, 'load upcoming accepted workouts');
  return (data ?? []).flatMap((row) => {
    const plan = toTodayPlan(row);
    return plan ? [plan] : [];
  });
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
