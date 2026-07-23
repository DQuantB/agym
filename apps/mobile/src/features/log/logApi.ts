import type { SupabaseClient } from '@supabase/supabase-js';

type CompletedWorkout = { id: string; confirmedAt: string; planTitle: string; notes: string; actual: { exercises?: { name?: string; sets?: unknown[] }[] } };
export type EvidenceHistoryItem = { id: string; label: 'RAW SELF-REPORT' | 'PARSED DRAFT · UNCERTAIN' | 'USER-CONFIRMED'; date: string; detail: string };
export async function loadCompletedWorkouts(client: SupabaseClient): Promise<CompletedWorkout[]> {
  const { data, error } = await client.from('canonical_events').select('id, confirmed_at, final_fields').eq('event_type', 'workout_execution').is('deleted_at', null).order('confirmed_at', { ascending: false }).limit(30);
  if (error) throw new Error(`AGYM could not load confirmed history: ${error.message}`);
  return (data ?? []).flatMap((row) => { const value = row.final_fields as Record<string, unknown>; const plan = value.planned_snapshot as Record<string, unknown> | undefined; const actual = value.actual as CompletedWorkout['actual'] | undefined; return plan && actual ? [{ id: row.id, confirmedAt: row.confirmed_at, planTitle: typeof plan.title === 'string' ? plan.title : 'Gym workout', notes: typeof value.additional_notes === 'string' ? value.additional_notes : '', actual }] : []; });
}
export async function loadEvidenceHistory(client: SupabaseClient): Promise<EvidenceHistoryItem[]> {
  const [raw, drafts, confirmed] = await Promise.all([
    client.from('raw_logs').select('id, raw_text, created_at').is('deleted_at', null).order('created_at', { ascending: false }).limit(20),
    client.from('parse_drafts').select('id, event_type, parse_status, created_at').order('created_at', { ascending: false }).limit(20),
    client.from('canonical_events').select('id, event_type, confirmed_at').neq('event_type', 'workout_execution').is('deleted_at', null).order('confirmed_at', { ascending: false }).limit(20),
  ]);
  for (const result of [raw, drafts, confirmed]) if (result.error) throw new Error(`AGYM could not load history: ${result.error.message}`);
  return [
    ...(raw.data ?? []).map((row) => ({ id: `raw-${row.id}`, label: 'RAW SELF-REPORT' as const, date: row.created_at, detail: row.raw_text })),
    ...(drafts.data ?? []).map((row) => ({ id: `draft-${row.id}`, label: 'PARSED DRAFT · UNCERTAIN' as const, date: row.created_at, detail: `${row.event_type} · ${row.parse_status}` })),
    ...(confirmed.data ?? []).map((row) => ({ id: `confirmed-${row.id}`, label: 'USER-CONFIRMED' as const, date: row.confirmed_at, detail: row.event_type })),
  ].sort((a, b) => b.date.localeCompare(a.date));
}
