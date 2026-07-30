import type { GymPlan } from './workoutApi';

export type PlanRevisionIssue = { path: string; message: string };

/**
 * Mirrors the checks in replace_future_gym_workout_plan
 * (supabase/migrations/20260726120000_add_future_gym_plan_revisions.sql:43-77)
 * so the editor can reject bad input before a round trip. The one rule this
 * cannot check is scheduled_for > caller_today, which depends on
 * profiles.timezone (not read by the mobile app).
 */
export function validatePlanRevision(plan: GymPlan): PlanRevisionIssue[] {
  const issues: PlanRevisionIssue[] = [];

  if (!plan.title.trim()) issues.push({ path: 'title', message: 'Title is required.' });
  if (plan.exercises.length === 0) issues.push({ path: 'exercises', message: 'At least one exercise is required.' });

  plan.exercises.forEach((exercise, exerciseIndex) => {
    const exercisePath = `exercises[${exerciseIndex}]`;
    if (!exercise.client_id.trim()) issues.push({ path: `${exercisePath}.client_id`, message: 'Exercise is missing an id.' });
    if (!exercise.name.trim()) issues.push({ path: `${exercisePath}.name`, message: 'Exercise name is required.' });
    if (exercise.sets.length === 0) issues.push({ path: `${exercisePath}.sets`, message: 'At least one set is required.' });

    exercise.sets.forEach((set, setIndex) => {
      const setPath = `${exercisePath}.sets[${setIndex}]`;
      if (!Number.isInteger(set.reps) || set.reps < 1) issues.push({ path: `${setPath}.reps`, message: 'Reps must be a whole number of at least 1.' });
      if (set.weight_kg != null && (!Number.isFinite(set.weight_kg) || set.weight_kg < 0)) issues.push({ path: `${setPath}.weight_kg`, message: 'Weight must be zero or a positive number.' });
      if (set.rest_seconds != null && (!Number.isInteger(set.rest_seconds) || set.rest_seconds < 0)) issues.push({ path: `${setPath}.rest_seconds`, message: 'Rest must be a whole number of seconds, zero or more.' });
    });
  });

  return issues;
}
