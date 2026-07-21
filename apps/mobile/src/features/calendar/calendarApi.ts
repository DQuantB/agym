import type { SupabaseClient } from '@supabase/supabase-js';

import { gymPlanSchema, type GymPlan } from '@/features/workout/workoutApi';

export type CalendarPlan = { id: string; status: 'proposed' | 'active'; source: string; createdAt: string; plan: GymPlan };

function fail(error: { message: string } | null, action: string): never { throw new Error(`AGYM could not ${action}: ${error?.message ?? 'no data returned.'}`); }

function mapPlan(row: { id: string; status: 'proposed' | 'active'; plan_data: unknown; agent_identifier: string | null; created_at: string }): CalendarPlan | null {
  const parsed = gymPlanSchema.safeParse(row.plan_data);
  if (!parsed.success) return null;
  return { id: row.id, status: row.status, source: row.agent_identifier ?? 'external LLM', createdAt: row.created_at, plan: parsed.data };
}

export async function loadCalendarPlans(client: SupabaseClient): Promise<{ proposal: CalendarPlan | null; active: CalendarPlan | null }> {
  const { data, error } = await client.from('plans').select('id, status, plan_data, agent_identifier, created_at').in('status', ['proposed', 'active']).eq('plan_data->>kind', 'gym_workout').is('deleted_at', null).order('created_at', { ascending: false }).limit(20);
  if (error) fail(error, 'load calendar plans');
  const plans = (data ?? []).flatMap((row) => {
    const status = row.status === 'proposed' || row.status === 'active' ? row.status : null;
    return status ? [mapPlan({ ...row, status })].filter((plan): plan is CalendarPlan => plan !== null) : [];
  });
  return { proposal: plans.find((plan) => plan.status === 'proposed') ?? null, active: plans.find((plan) => plan.status === 'active') ?? null };
}

export async function loadProposalById(client: SupabaseClient, planId: string): Promise<CalendarPlan | null> {
  const { data, error } = await client.from('plans').select('id, status, plan_data, agent_identifier, created_at').eq('id', planId).eq('status', 'proposed').eq('plan_data->>kind', 'gym_workout').is('deleted_at', null).maybeSingle();
  if (error) fail(error, 'load this Gym proposal');
  if (!data || data.status !== 'proposed') return null;
  return mapPlan({ ...data, status: 'proposed' });
}

export async function acceptCalendarProposal(client: SupabaseClient, planId: string): Promise<void> {
  const { error } = await client.rpc('accept_gym_workout_plan', { p_plan_id: planId });
  if (error) fail(error, 'accept this Gym proposal');
}
