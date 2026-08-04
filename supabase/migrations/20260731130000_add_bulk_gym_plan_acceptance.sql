-- Accepting a multi-day training block currently requires one
-- accept_gym_workout_plan call per day. This adds a bulk variant that
-- accepts several proposals in one call, reusing the same supersede-on-accept
-- core logic per id so a same-date collision within one batch resolves the
-- same way it would across separate calls. Each id is processed
-- independently (one bad id reports its own failure rather than aborting
-- the whole batch), matching "keep going, tell me what happened" rather than
-- an all-or-nothing transaction.
create or replace function public.accept_gym_workout_plans(p_plan_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  plan_id uuid;
  item_result jsonb;
  results jsonb := '[]'::jsonb;
begin
  if caller is null then
    raise exception 'gym plan acceptance requires an authenticated user';
  end if;

  foreach plan_id in array p_plan_ids loop
    begin
      item_result := public.accept_gym_workout_plan_core(caller, plan_id);
      results := results || jsonb_build_array(jsonb_build_object('id', plan_id, 'ok', true, 'result', item_result));
    exception when others then
      results := results || jsonb_build_array(jsonb_build_object('id', plan_id, 'ok', false, 'error', sqlerrm));
    end;
  end loop;

  return jsonb_build_object('results', results);
end;
$$;

revoke all on function public.accept_gym_workout_plans(uuid[])
  from public, anon, service_role;
grant execute on function public.accept_gym_workout_plans(uuid[]) to authenticated;
