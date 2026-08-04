import type { SupabaseClient } from '@supabase/supabase-js';

import { effectiveGymPlan, type GymPlan } from '@/features/workout/workoutApi';

export type CalendarPlan = { id: string; status: 'proposed' | 'active'; source: string; createdAt: string; scheduledFor: string; plan: GymPlan };

function fail(error: { message: string } | null, action: string): never { throw new Error(`AGYM could not ${action}: ${error?.message ?? 'no data returned.'}`); }

function mapPlan(row: { id: string; status: 'proposed' | 'active'; plan_data: unknown; user_revision_data?: unknown; source_client: string | null; created_at: string; scheduled_for: string | null }): CalendarPlan | null {
  const plan = effectiveGymPlan(row);
  return plan ? { id: row.id, status: row.status, source: row.source_client ?? 'external LLM', createdAt: row.created_at, scheduledFor: row.scheduled_for ?? plan.scheduled_for, plan } : null;
}

export async function loadCalendarPlans(client: SupabaseClient, limit = 60): Promise<{ proposals: CalendarPlan[]; scheduled: CalendarPlan[] }> {
  const { data, error } = await client.from('plans')
    .select('id, status, plan_data, user_revision_data, source_client, created_at, scheduled_for')
    .in('status', ['proposed', 'active']).eq('plan_data->>kind', 'gym_workout').is('deleted_at', null)
    .order('scheduled_for', { ascending: true }).order('created_at', { ascending: false }).limit(limit);
  if (error) fail(error, 'load calendar plans');
  const plans = (data ?? []).flatMap((row) => {
    const status = row.status === 'proposed' || row.status === 'active' ? row.status : null;
    return status ? [mapPlan({ ...row, status })].filter((plan): plan is CalendarPlan => plan !== null) : [];
  });
  return {
    proposals: plans.filter((plan) => plan.status === 'proposed').sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    scheduled: plans.filter((plan) => plan.status === 'active'),
  };
}

export async function loadProposalById(client: SupabaseClient, planId: string): Promise<CalendarPlan | null> {
  const { data, error } = await client.from('plans').select('id, status, plan_data, user_revision_data, source_client, created_at, scheduled_for').eq('id', planId).eq('status', 'proposed').eq('plan_data->>kind', 'gym_workout').is('deleted_at', null).maybeSingle();
  if (error) fail(error, 'load this Gym proposal');
  if (!data || data.status !== 'proposed') return null;
  return mapPlan({ ...data, status: 'proposed' });
}

/** Finds already-active plans of the same category on any of the given dates, so the UI can warn the user before accepting replaces them. */
export async function findActivePlanConflicts(client: SupabaseClient, kind: string, scheduledForDates: string[]): Promise<{ id: string; scheduledFor: string }[]> {
  const dates = [...new Set(scheduledForDates)];
  if (!dates.length) return [];
  const { data, error } = await client.from('plans')
    .select('id, scheduled_for')
    .eq('status', 'active').eq('plan_data->>kind', kind).in('scheduled_for', dates).is('deleted_at', null);
  if (error) fail(error, 'check for existing plans on these dates');
  return (data ?? []).map((row) => ({ id: row.id as string, scheduledFor: row.scheduled_for as string }));
}

export async function acceptCalendarProposal(client: SupabaseClient, planId: string): Promise<void> {
  const { error } = await client.rpc('accept_gym_workout_plan', { p_plan_id: planId });
  if (error) fail(error, 'accept this Gym proposal');
}

/** Accepts a batch of proposals one at a time (e.g. a repeated plan's occurrences) and reports which, if any, failed rather than aborting the whole batch. */
export async function acceptCalendarProposals(client: SupabaseClient, planIds: string[]): Promise<{ accepted: string[]; failed: { id: string; message: string }[] }> {
  const accepted: string[] = [];
  const failed: { id: string; message: string }[] = [];
  for (const planId of planIds) {
    try {
      await acceptCalendarProposal(client, planId);
      accepted.push(planId);
    } catch (error) {
      failed.push({ id: planId, message: error instanceof Error ? error.message : 'Could not accept this proposal.' });
    }
  }
  return { accepted, failed };
}
