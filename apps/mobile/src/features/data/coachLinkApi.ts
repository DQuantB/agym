import type { SupabaseClient } from '@supabase/supabase-js';

export type CoachLink = { id: string; coachName: string; linkedAt: string };

export async function loadMyCoachLink(client: SupabaseClient): Promise<CoachLink | null> {
  const { data, error } = await client
    .from('coach_client_links')
    .select('id, linked_at, coach_profiles(display_name)')
    .eq('status', 'active')
    .maybeSingle();

  if (error) throw new Error(`AGYM could not load your coach link: ${error.message}`);
  if (!data) return null;

  const coach = Array.isArray(data.coach_profiles) ? data.coach_profiles[0] : data.coach_profiles;
  return { id: data.id, coachName: coach?.display_name ?? 'Your coach', linkedAt: data.linked_at };
}

export async function redeemCoachCode(client: SupabaseClient, code: string): Promise<CoachLink> {
  const { data, error } = await client.rpc('redeem_coach_code', { p_code: code.trim() });
  if (error) throw new Error(error.message);

  const result = data as { linkId: string; coachName: string; linkedAt: string };
  return { id: result.linkId, coachName: result.coachName, linkedAt: result.linkedAt };
}

export async function unlinkCoach(client: SupabaseClient, linkId: string): Promise<void> {
  const { error } = await client.rpc('revoke_coach_link', { p_link_id: linkId });
  if (error) throw new Error(`AGYM could not remove this coach link: ${error.message}`);
}
