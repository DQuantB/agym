-- In-app manual workout creation, for users who don't use an AI agent to
-- write their plans. Reuses the existing propose-then-accept pipeline rather
-- than adding a parallel write path: this inserts a 'proposed' gym_workout
-- plan (source_client 'agym-manual-entry', distinguishing it from
-- agent-authored proposals) and immediately calls the same
-- accept_gym_workout_plan_core used by every other acceptance path, so
-- same-date supersession behaves identically regardless of how a plan
-- originated. Shape validation mirrors replace_future_gym_workout_plan's.
create or replace function public.create_manual_gym_plan(p_plan_data jsonb, p_scheduled_for date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_timezone text;
  caller_today date;
  new_exercise jsonb;
  new_set jsonb;
  new_plan public.plans;
begin
  if caller is null then
    raise exception 'creating a Gym plan requires an authenticated user';
  end if;

  select timezone into caller_timezone from public.profiles where id = caller;
  if caller_timezone is null then
    raise exception 'profile timezone is required to create a Gym plan';
  end if;
  caller_today := (now() at time zone caller_timezone)::date;

  if p_scheduled_for is null or p_scheduled_for < caller_today then
    raise exception 'a manually created Gym plan must be scheduled for today or a future date';
  end if;

  if jsonb_typeof(p_plan_data) <> 'object'
    or p_plan_data ->> 'kind' <> 'gym_workout'
    or p_plan_data ->> 'schema_version' <> '1'
    or p_plan_data ->> 'scheduled_for' <> p_scheduled_for::text
    or nullif(trim(coalesce(p_plan_data ->> 'title', '')), '') is null
    or jsonb_typeof(p_plan_data -> 'exercises') <> 'array'
    or jsonb_array_length(p_plan_data -> 'exercises') = 0 then
    raise exception 'a manually created Gym plan needs a title and at least one exercise';
  end if;

  for new_exercise in select value from jsonb_array_elements(p_plan_data -> 'exercises') loop
    if jsonb_typeof(new_exercise) <> 'object'
      or nullif(trim(coalesce(new_exercise ->> 'client_id', '')), '') is null
      or nullif(trim(coalesce(new_exercise ->> 'name', '')), '') is null
      or jsonb_typeof(new_exercise -> 'sets') <> 'array'
      or jsonb_array_length(new_exercise -> 'sets') = 0 then
      raise exception 'each exercise needs an id, name, and at least one set';
    end if;
    for new_set in select value from jsonb_array_elements(new_exercise -> 'sets') loop
      if jsonb_typeof(new_set) <> 'object'
        or coalesce(new_set ->> 'reps', '') !~ '^[1-9][0-9]*$'
        or (new_set ? 'weight_kg' and new_set -> 'weight_kg' <> 'null'::jsonb and (jsonb_typeof(new_set -> 'weight_kg') <> 'number' or (new_set ->> 'weight_kg')::numeric < 0))
        or (new_set ? 'rest_seconds' and (coalesce(new_set ->> 'rest_seconds', '') !~ '^[0-9]+$')) then
        raise exception 'each set requires positive reps and valid nonnegative load/rest values';
      end if;
    end loop;
  end loop;

  insert into public.plans (user_id, raw_plan_text, plan_data, status, source_client, scheduled_for)
  values (caller, coalesce(p_plan_data ->> 'title', 'Manually created workout'), p_plan_data, 'proposed', 'agym-manual-entry', p_scheduled_for)
  returning * into new_plan;

  return public.accept_gym_workout_plan_core(caller, new_plan.id);
end;
$$;

revoke all on function public.create_manual_gym_plan(jsonb, date) from public, anon, service_role;
grant execute on function public.create_manual_gym_plan(jsonb, date) to authenticated;
