import type { SupabaseClient } from '@supabase/supabase-js';

export type WorkoutSet = { reps: number | null; weightKg: number | null; rpe: number | null };
export type WorkoutExercise = { name: string; sets: WorkoutSet[] };
export type DraftFields = {
  kind: 'workout' | 'note';
  exercises?: WorkoutExercise[];
  text?: string;
  durationMin?: number | null;
  notes?: string | null;
};

export type CaptureDraft = {
  id: string;
  rawLogId: string;
  fields: DraftFields;
  safetyFlags: { field: string; reason: string }[];
  status: 'parsed' | 'partial' | 'failed';
  parserVersion: string | null;
};

type CanonicalConfirmationInput = {
  userId: string;
  clientId: string;
  draft: CaptureDraft;
  originalFields: DraftFields;
};

export function applyWorkoutCorrection(
  fields: DraftFields,
  exerciseIndex: number,
  setIndex: number,
  patch: Partial<Pick<WorkoutExercise, 'name'>> & Partial<Pick<WorkoutSet, 'reps' | 'weightKg'>>,
): DraftFields {
  if (fields.kind !== 'workout' || !fields.exercises?.[exerciseIndex] || !fields.exercises[exerciseIndex].sets[setIndex]) return fields;
  const exercises = fields.exercises.map((exercise, currentExerciseIndex) => {
    if (currentExerciseIndex !== exerciseIndex) return exercise;
    return {
      ...exercise,
      ...(patch.name === undefined ? {} : { name: patch.name || 'Exercise' }),
      sets: exercise.sets.map((set, currentSetIndex) => currentSetIndex === setIndex
        ? { ...set, ...(patch.reps === undefined ? {} : { reps: patch.reps }), ...(patch.weightKg === undefined ? {} : { weightKg: patch.weightKg }) }
        : set),
    };
  });
  return { ...fields, exercises };
}

export function buildCanonicalConfirmationPayload(input: CanonicalConfirmationInput) {
  const correctionDiff = JSON.stringify(input.originalFields) === JSON.stringify(input.draft.fields)
    ? null
    : { original_fields: input.originalFields, confirmed_fields: input.draft.fields };
  return {
    user_id: input.userId,
    client_id: input.clientId,
    source_raw_log_id: input.draft.rawLogId,
    source_parse_draft_id: input.draft.id,
    event_type: input.draft.fields.kind,
    final_fields: input.draft.fields,
    correction_diff: correctionDiff,
    provenance: 'user_confirmed' as const,
  };
}

function requireData<T>(data: T | null, error: { message: string } | null, action: string): T {
  if (error) throw new Error(`AGYM could not ${action}: ${error.message}`);
  if (data === null) throw new Error(`AGYM could not ${action}: no data was returned.`);
  return data;
}

function draftFromRow(row: { id: string; raw_log_id: string; fields: DraftFields; safety_flags: unknown; parse_status: CaptureDraft['status']; parser_version: string | null }): CaptureDraft {
  return {
    id: row.id,
    rawLogId: row.raw_log_id,
    fields: row.fields,
    safetyFlags: Array.isArray(row.safety_flags) ? row.safety_flags.filter((flag): flag is { field: string; reason: string } => Boolean(flag && typeof flag === 'object' && typeof (flag as { field?: unknown }).field === 'string' && typeof (flag as { reason?: unknown }).reason === 'string')) : [],
    status: row.parse_status,
    parserVersion: row.parser_version,
  };
}

export async function saveRawLogAndCreateDraft(client: SupabaseClient, userId: string, input: { text: string; date: string; sourceHint?: 'workout' | 'meal' | 'sleep' | 'mood' | 'other'; planId?: string | null }): Promise<CaptureDraft> {
  if (!input.text.trim()) throw new Error('Write a log before parsing it.');
  const rawResult = await client.from('raw_logs').insert({ user_id: userId, client_id: `mobile-raw-${Date.now()}-${Math.random().toString(36).slice(2)}`, raw_text: input.text, logged_for_date: input.date, source_hint: input.sourceHint ?? null, plan_id: input.planId ?? null, client_meta: { source: 'mobile_capture' } }).select('id').single();
  const raw = requireData(rawResult.data, rawResult.error, 'save your raw log') as { id: string };
  const draftResult = await client.rpc('create_deterministic_parse_draft', { p_raw_log_id: raw.id });
  const drafts = requireData(draftResult.data, draftResult.error, 'create a review draft') as Parameters<typeof draftFromRow>[0][];
  if (!drafts[0]) throw new Error('AGYM could not create a review draft. Your raw log remains saved.');
  return draftFromRow(drafts[0]);
}

export async function confirmCaptureDraft(client: SupabaseClient, userId: string, draft: CaptureDraft, originalFields: DraftFields): Promise<void> {
  const { error } = await client.from('canonical_events').insert(buildCanonicalConfirmationPayload({
    userId,
    draft,
    originalFields,
    clientId: `mobile-event-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  }));
  if (error) throw new Error(`AGYM could not confirm your corrected result: ${error.message}`);
}
