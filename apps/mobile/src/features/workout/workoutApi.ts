import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

const setSchema = z.object({ reps: z.number().int().min(1), weight_kg: z.number().nullable().optional(), rest_seconds: z.number().int().min(0).default(120) });
const exerciseSchema = z.object({ client_id: z.string().min(1), name: z.string().min(1), catalogue_exercise_id: z.string().uuid().optional(), sets: z.array(setSchema).min(1) });
export const gymPlanSchema = z.object({ kind: z.literal('gym_workout'), schema_version: z.literal(1), scheduled_for: z.string(), title: z.string().min(1), exercises: z.array(exerciseSchema).min(1), notes: z.string().optional() });
export type GymPlan = z.infer<typeof gymPlanSchema>;
export type ActualSet = z.infer<typeof setSchema> & { completed: boolean; skipped_reason: string | null; user_added: boolean };
export type ActualExercise = Omit<z.infer<typeof exerciseSchema>, 'sets'> & { user_added: boolean; sets: ActualSet[] };
export type ActualData = { kind: 'gym_workout_execution'; schema_version: 1; exercises: ActualExercise[] };
export type RemoteExecution = { id: string; status: 'in_progress' | 'completed'; executionData: ActualData; additionalNotes: string };

export function actualFromPlan(plan: GymPlan): ActualData {
  return { kind: 'gym_workout_execution', schema_version: 1, exercises: plan.exercises.map((exercise) => ({ ...exercise, user_added: false, sets: exercise.sets.map((set) => ({ ...set, completed: false, skipped_reason: null, user_added: false })) })) };
}

function fail(error: { message: string } | null, action: string): never { throw new Error(`AGYM could not ${action}: ${error?.message ?? 'no data returned.'}`); }

export async function loadActiveWorkout(client: SupabaseClient, date: string): Promise<{ planId: string; plan: GymPlan; execution: RemoteExecution | null } | null> {
  const { data: planRow, error } = await client.from('plans').select('id, plan_data').eq('scheduled_for', date).eq('status', 'active').eq('plan_data->>kind', 'gym_workout').is('deleted_at', null).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) fail(error, "load today's accepted workout");
  if (!planRow) return null;
  const plan = gymPlanSchema.safeParse(planRow.plan_data);
  if (!plan.success) return null;
  const { data: executionRow, error: executionError } = await client.from('workout_executions').select('id, status, execution_data, additional_notes').eq('plan_id', planRow.id).order('started_at', { ascending: false }).limit(1).maybeSingle();
  if (executionError) fail(executionError, 'load workout progress');
  if (!executionRow) return { planId: planRow.id, plan: plan.data, execution: null };
  const actual = z.object({ kind: z.literal('gym_workout_execution'), schema_version: z.literal(1), exercises: z.array(z.any()) }).safeParse(executionRow.execution_data);
  if (!actual.success || (executionRow.status !== 'in_progress' && executionRow.status !== 'completed')) return { planId: planRow.id, plan: plan.data, execution: null };
  return { planId: planRow.id, plan: plan.data, execution: { id: executionRow.id, status: executionRow.status, executionData: actual.data as ActualData, additionalNotes: executionRow.additional_notes } };
}

export async function startRemoteExecution(client: SupabaseClient, userId: string, planId: string, plan: GymPlan, actualData: ActualData): Promise<string> {
  const { data, error } = await client.from('workout_executions').insert({ user_id: userId, plan_id: planId, scheduled_for: plan.scheduled_for, planned_snapshot: plan, execution_data: actualData }).select('id').single();
  if (error) fail(error, 'start this accepted workout');
  return data.id;
}

export async function syncRemoteExecution(client: SupabaseClient, executionId: string, actualData: ActualData, additionalNotes: string): Promise<void> {
  const { error } = await client.from('workout_executions').update({ execution_data: actualData, additional_notes: additionalNotes }).eq('id', executionId);
  if (error) fail(error, 'sync workout progress');
}

export async function confirmRemoteExecution(client: SupabaseClient, executionId: string): Promise<void> {
  const { error } = await client.rpc('complete_gym_workout_execution', { p_execution_id: executionId });
  if (error) fail(error, 'confirm this workout');
}
