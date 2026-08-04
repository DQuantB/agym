import type { SupabaseClient } from '@supabase/supabase-js';

export type CoachProfile = { userId: string; displayName: string };
export type CoachCode = { id: string; code: string; requiresPayment: boolean; useCount: number; maxUses: number | null; active: boolean };
export type CoachClient = { linkId: string; clientId: string; displayName: string; linkedAt: string };
export type ClientPlan = { id: string; title: string; status: string; scheduledFor: string | null; createdAt: string };
export type ClientEvent = { id: string; eventType: string; finalFields: unknown; confirmedAt: string };

export async function loadMyCoachProfile(client: SupabaseClient): Promise<CoachProfile | null> {
  const { data, error } = await client.from('coach_profiles').select('user_id, display_name').maybeSingle();
  if (error) throw new Error(`AGym could not load your coach profile: ${error.message}`);
  return data ? { userId: data.user_id, displayName: data.display_name } : null;
}

export async function loadMyCoachCodes(client: SupabaseClient): Promise<CoachCode[]> {
  const { data, error } = await client
    .from('coach_codes')
    .select('id, code, requires_payment, use_count, max_uses, active')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`AGym could not load your coach codes: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id, code: row.code, requiresPayment: row.requires_payment, useCount: row.use_count, maxUses: row.max_uses, active: row.active,
  }));
}

export async function generateCoachCode(client: SupabaseClient): Promise<CoachCode> {
  const { data, error } = await client.rpc('generate_coach_code');
  if (error) throw new Error(error.message);
  return { id: data.id, code: data.code, requiresPayment: data.requires_payment, useCount: data.use_count, maxUses: data.max_uses, active: data.active };
}

export async function loadMyClients(client: SupabaseClient): Promise<CoachClient[]> {
  const { data, error } = await client
    .from('coach_client_links')
    .select('id, client_id, linked_at, profiles(display_name)')
    .eq('status', 'active')
    .order('linked_at', { ascending: false });
  if (error) throw new Error(`AGym could not load your client roster: ${error.message}`);
  return (data ?? []).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return { linkId: row.id, clientId: row.client_id, displayName: profile?.display_name ?? 'A client', linkedAt: row.linked_at };
  });
}

export async function loadClientPlans(client: SupabaseClient, clientId: string): Promise<ClientPlan[]> {
  const { data, error } = await client
    .from('plans')
    .select('id, plan_data, status, scheduled_for, created_at')
    .eq('user_id', clientId)
    .order('scheduled_for', { ascending: false })
    .limit(20);
  if (error) throw new Error(`AGym could not load this client's plans: ${error.message}`);
  return (data ?? []).map((row) => {
    const planData = row.plan_data as { title?: string } | null;
    return { id: row.id, title: planData?.title ?? 'Untitled plan', status: row.status, scheduledFor: row.scheduled_for, createdAt: row.created_at };
  });
}

export async function loadClientEvents(client: SupabaseClient, clientId: string): Promise<ClientEvent[]> {
  const { data, error } = await client
    .from('canonical_events')
    .select('id, event_type, final_fields, confirmed_at')
    .eq('user_id', clientId)
    .order('confirmed_at', { ascending: false })
    .limit(30);
  if (error) throw new Error(`AGym could not load this client's confirmed outcomes: ${error.message}`);
  return (data ?? []).map((row) => ({ id: row.id, eventType: row.event_type, finalFields: row.final_fields, confirmedAt: row.confirmed_at }));
}
