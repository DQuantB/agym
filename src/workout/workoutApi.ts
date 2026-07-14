import type { SupabaseClient } from '@supabase/supabase-js';
import { gymWorkoutPlanSchema, type GymWorkoutPlan, type WorkoutExecutionData } from './gymSchemas';

export interface WorkoutExecutionRow { id: string; plan_id: string; scheduled_for: string; status: 'in_progress' | 'completed'; planned_snapshot: GymWorkoutPlan; execution_data: WorkoutExecutionData; additional_notes: string; completed_at: string | null; }

function fail(error: { message: string } | null, action: string): never { throw new Error(`AGym could not ${action}: ${error?.message ?? 'no data returned.'}`); }

export async function loadWorkout(client: SupabaseClient, date: string): Promise<{ plan: GymWorkoutPlan; planId: string; execution: WorkoutExecutionRow | null } | null> {
  const { data: plan, error } = await client.from('plans').select('id, plan_data').eq('scheduled_for', date).eq('plan_data->>kind', 'gym_workout').is('deleted_at', null).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) fail(error, 'load today\'s workout');
  if (!plan) return null;
  const parsed = gymWorkoutPlanSchema.safeParse(plan.plan_data);
  if (!parsed.success) return null;
  const { data: execution, error: executionError } = await client.from('workout_executions').select('id, plan_id, scheduled_for, status, planned_snapshot, execution_data, additional_notes, completed_at').eq('plan_id', plan.id).order('started_at', { ascending: false }).limit(1).maybeSingle();
  if (executionError) fail(executionError, 'load workout progress');
  return { plan: parsed.data, planId: plan.id, execution: execution as WorkoutExecutionRow | null };
}

export async function startWorkout(client: SupabaseClient, userId: string, planId: string, plan: GymWorkoutPlan, executionData: WorkoutExecutionData): Promise<WorkoutExecutionRow> {
  const { data, error } = await client.from('workout_executions').insert({ user_id: userId, plan_id: planId, scheduled_for: plan.scheduled_for, planned_snapshot: plan, execution_data: executionData }).select('id, plan_id, scheduled_for, status, planned_snapshot, execution_data, additional_notes, completed_at').single();
  if (error) fail(error, 'start this workout');
  return data as WorkoutExecutionRow;
}

export async function saveWorkout(client: SupabaseClient, id: string, executionData: WorkoutExecutionData, additionalNotes: string): Promise<void> {
  const { error } = await client.from('workout_executions').update({ execution_data: executionData, additional_notes: additionalNotes }).eq('id', id);
  if (error) fail(error, 'save workout progress');
}

export async function completeWorkout(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.rpc('complete_gym_workout_execution', { p_execution_id: id });
  if (error) fail(error, 'finish this workout');
}
