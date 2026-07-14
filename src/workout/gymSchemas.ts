import { z } from 'zod';

export const gymSetSchema = z.object({
  reps: z.number().int().min(1).max(100),
  weight_kg: z.number().min(0).max(1000).nullable().optional(),
  rest_seconds: z.number().int().min(0).max(3600).default(120),
});

export const gymExerciseSchema = z.object({
  client_id: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(120),
  sets: z.array(gymSetSchema).min(1).max(20),
});

export const gymWorkoutPlanSchema = z.object({
  kind: z.literal('gym_workout'),
  schema_version: z.literal(1),
  scheduled_for: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().trim().min(1).max(160),
  exercises: z.array(gymExerciseSchema).min(1).max(30),
  notes: z.string().trim().max(2000).optional(),
});

export type GymWorkoutPlan = z.infer<typeof gymWorkoutPlanSchema>;
export type GymSet = z.infer<typeof gymSetSchema>;
export type GymExercise = z.infer<typeof gymExerciseSchema>;

export const actualGymSetSchema = gymSetSchema.extend({ completed: z.boolean().default(false), user_added: z.boolean().default(false) });
export const actualGymExerciseSchema = gymExerciseSchema.extend({ sets: z.array(actualGymSetSchema).min(1).max(30), user_added: z.boolean().default(false) });
export const workoutExecutionDataSchema = z.object({ kind: z.literal('gym_workout_execution'), schema_version: z.literal(1), exercises: z.array(actualGymExerciseSchema).min(1).max(40) });
export type WorkoutExecutionData = z.infer<typeof workoutExecutionDataSchema>;

export function executionFromPlan(plan: GymWorkoutPlan): WorkoutExecutionData {
  return { kind: 'gym_workout_execution', schema_version: 1, exercises: plan.exercises.map((exercise) => ({ ...exercise, user_added: false, sets: exercise.sets.map((set) => ({ ...set, completed: false, user_added: false })) })) };
}

export function todayLocalDate(date = new Date()): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}
