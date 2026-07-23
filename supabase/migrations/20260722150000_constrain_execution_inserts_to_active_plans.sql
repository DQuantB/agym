-- A browser may create a workout execution only from its own accepted Gym plan.
-- The client-side active-plan query is UX, not the authorization boundary.

drop policy if exists "users start their workout executions" on public.workout_executions;

create policy "users start their workout executions" on public.workout_executions
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and status = 'in_progress'
    and completed_at is null
    and exists (
      select 1
      from public.plans
      where plans.id = workout_executions.plan_id
        and plans.user_id = (select auth.uid())
        and plans.status = 'active'
        and plans.plan_data->>'kind' = 'gym_workout'
        and plans.deleted_at is null
    )
  );
