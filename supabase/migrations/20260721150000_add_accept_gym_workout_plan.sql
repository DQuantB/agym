-- A proposed Gym plan is an agent-authored candidate. Only its authenticated
-- owner can accept it, and acceptance is the sole proposed -> active transition.
create or replace function public.accept_gym_workout_plan(p_plan_id uuid)
returns public.plans
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  proposed_plan public.plans;
  accepted_plan public.plans;
begin
  if caller is null then
    raise exception 'gym plan acceptance requires an authenticated user';
  end if;

  select * into proposed_plan
  from public.plans
  where id = p_plan_id and user_id = caller
  for update;

  if not found then
    raise exception 'gym plan was not found for this account';
  end if;
  if proposed_plan.status <> 'proposed' then
    raise exception 'gym plan is not awaiting acceptance';
  end if;
  if coalesce(proposed_plan.plan_data ->> 'kind', '') <> 'gym_workout' then
    raise exception 'only structured gym_workout plans can be accepted here';
  end if;

  update public.plans
  set status = 'active'
  where id = proposed_plan.id and user_id = caller
  returning * into accepted_plan;

  return accepted_plan;
end;
$$;

revoke execute on function public.accept_gym_workout_plan(uuid) from public;
revoke execute on function public.accept_gym_workout_plan(uuid) from anon;
revoke execute on function public.accept_gym_workout_plan(uuid) from service_role;
grant execute on function public.accept_gym_workout_plan(uuid) to authenticated;
