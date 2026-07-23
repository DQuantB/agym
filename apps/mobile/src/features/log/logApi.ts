import type { SupabaseClient } from '@supabase/supabase-js';

type CompletedWorkout = { id: string; confirmedAt: string; planTitle: string; notes: string; actual: { exercises?: { name?: string; sets?: unknown[] }[] } };
export async function loadCompletedWorkouts(client: SupabaseClient): Promise<CompletedWorkout[]> {
  const { data, error } = await client.from('canonical_events').select('id, confirmed_at, final_fields').eq('event_type', 'workout_execution').is('deleted_at', null).order('confirmed_at', { ascending: false }).limit(30);
  if (error) throw new Error(`AGYM could not load confirmed history: ${error.message}`);
  return (data ?? []).flatMap((row) => { const value = row.final_fields as Record<string, unknown>; const plan = value.planned_snapshot as Record<string, unknown> | undefined; const actual = value.actual as CompletedWorkout['actual'] | undefined; return plan && actual ? [{ id: row.id, confirmedAt: row.confirmed_at, planTitle: typeof plan.title === 'string' ? plan.title : 'Gym workout', notes: typeof value.additional_notes === 'string' ? value.additional_notes : '', actual }] : []; });
}
