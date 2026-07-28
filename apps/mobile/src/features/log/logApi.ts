import type { SupabaseClient } from '@supabase/supabase-js';

import { parseConfirmedWorkout, type ConfirmedWorkout } from './confirmedWorkout';

export type EvidenceHistoryItem = { id: string; label: 'RAW SELF-REPORT' | 'PARSED DRAFT · UNCERTAIN' | 'USER-CONFIRMED'; date: string; detail: string };
export type RawEvidence = { id: string; text: string; createdAt: string };

async function mergeExecutionDurations(client: SupabaseClient, workouts: ConfirmedWorkout[]): Promise<ConfirmedWorkout[]> {
  const executionIds = workouts.map((workout) => workout.executionId).filter((id): id is string => id !== null);
  if (!executionIds.length) return workouts;
  const { data, error } = await client.from('workout_executions').select('id, started_at, completed_at').in('id', executionIds);
  if (error) throw new Error(`AGYM could not load workout durations: ${error.message}`);
  const byId = new Map((data ?? []).map((row) => [row.id as string, row]));
  return workouts.map((workout) => {
    const execution = workout.executionId ? byId.get(workout.executionId) : undefined;
    return execution ? { ...workout, startedAt: execution.started_at, completedAt: execution.completed_at } : workout;
  });
}

export async function loadCompletedWorkouts(client: SupabaseClient, limit = 30): Promise<ConfirmedWorkout[]> {
  const { data, error } = await client.from('canonical_events')
    .select('id, confirmed_at, final_fields, source_raw_log_id, plan_id')
    .eq('event_type', 'workout_execution').is('deleted_at', null)
    .order('confirmed_at', { ascending: false }).limit(limit);
  if (error) throw new Error(`AGYM could not load confirmed history: ${error.message}`);
  const workouts = (data ?? []).map(parseConfirmedWorkout).filter((workout): workout is ConfirmedWorkout => workout !== null);
  return mergeExecutionDurations(client, workouts);
}

export async function loadConfirmedWorkoutDetail(client: SupabaseClient, canonicalEventId: string): Promise<{ workout: ConfirmedWorkout; rawEvidence: RawEvidence | null } | null> {
  const { data, error } = await client.from('canonical_events')
    .select('id, confirmed_at, final_fields, source_raw_log_id, plan_id')
    .eq('id', canonicalEventId).is('deleted_at', null).maybeSingle();
  if (error) throw new Error(`AGYM could not load this session: ${error.message}`);
  if (!data) return null;
  const parsed = parseConfirmedWorkout(data);
  if (!parsed) return null;
  const [workout] = await mergeExecutionDurations(client, [parsed]);

  let rawEvidence: RawEvidence | null = null;
  if (workout.sourceRawLogId) {
    const { data: rawRow, error: rawError } = await client.from('raw_logs').select('id, raw_text, created_at').eq('id', workout.sourceRawLogId).maybeSingle();
    if (rawError) throw new Error(`AGYM could not load raw evidence: ${rawError.message}`);
    if (rawRow) rawEvidence = { id: rawRow.id, text: rawRow.raw_text, createdAt: rawRow.created_at };
  }
  return { workout, rawEvidence };
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
