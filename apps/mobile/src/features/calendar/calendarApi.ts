import type { SupabaseClient } from '@supabase/supabase-js';

import { effectiveGymPlan, type GymPlan } from '@/features/workout/workoutApi';

export type CalendarPlan = { id: string; status: 'proposed' | 'active'; source: string; createdAt: string; scheduledFor: string; plan: GymPlan };

function fail(error: { message: string } | null, action: string): never { throw new Error(`AGYM could not ${action}: ${error?.message ?? 'no data returned.'}`); }

function supersededTitleFrom(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const superseded = (data as { superseded?: unknown }).superseded;
  if (!superseded || typeof superseded !== 'object') return null;
  const title = (superseded as { title?: unknown }).title;
  return typeof title === 'string' ? title : null;
}

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

export async function acceptCalendarProposal(client: SupabaseClient, planId: string): Promise<{ supersededTitle: string | null }> {
  const { data, error } = await client.rpc('accept_gym_workout_plan', { p_plan_id: planId });
  if (error) fail(error, 'accept this Gym proposal');
  return { supersededTitle: supersededTitleFrom(data) };
}

export type SupersededPlan = { id: string; title: string };

export async function loadSupersededPlansByDate(client: SupabaseClient, limit = 200): Promise<Map<string, SupersededPlan>> {
  const { data, error } = await client.from('plans')
    .select('id, plan_data, user_revision_data, scheduled_for, updated_at')
    .eq('status', 'superseded').eq('plan_data->>kind', 'gym_workout').is('deleted_at', null)
    .order('updated_at', { ascending: false }).limit(limit);
  if (error) fail(error, 'load previous plans');
  const byDate = new Map<string, SupersededPlan>();
  for (const row of data ?? []) {
    if (!row.scheduled_for || byDate.has(row.scheduled_for)) continue;
    const plan = effectiveGymPlan(row);
    if (plan) byDate.set(row.scheduled_for, { id: row.id, title: plan.title });
  }
  return byDate;
}

export async function restoreSupersededPlan(client: SupabaseClient, planId: string): Promise<{ restoredTitle: string; supersededTitle: string | null }> {
  const { data, error } = await client.rpc('restore_superseded_gym_plan', { p_plan_id: planId });
  if (error) fail(error, 'restore this previous plan');
  const row = data && typeof data === 'object' ? (data as { plan?: unknown }).plan : null;
  const restoredPlan = row && typeof row === 'object' ? effectiveGymPlan(row as { plan_data: unknown; user_revision_data?: unknown }) : null;
  return { restoredTitle: restoredPlan?.title ?? 'Gym workout', supersededTitle: supersededTitleFrom(data) };
}

export type AcceptProposalResult = { id: string; ok: boolean; supersededTitle?: string | null; error?: string };

export async function acceptCalendarProposals(client: SupabaseClient, planIds: string[]): Promise<AcceptProposalResult[]> {
  const { data, error } = await client.rpc('accept_gym_workout_plans', { p_plan_ids: planIds });
  if (error) fail(error, 'accept these Gym proposals');
  const results = data && typeof data === 'object' ? (data as { results?: unknown }).results : null;
  if (!Array.isArray(results)) return [];
  return results.map((item) => {
    const record = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    const id = typeof record.id === 'string' ? record.id : '';
    const ok = record.ok === true;
    if (!ok) return { id, ok: false, error: typeof record.error === 'string' ? record.error : 'Could not accept this proposal.' };
    return { id, ok: true, supersededTitle: supersededTitleFrom(record.result) };
  });
}
