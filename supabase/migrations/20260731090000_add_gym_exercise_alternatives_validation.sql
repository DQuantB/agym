-- Validate the optional `alternatives` array on a revised future Gym plan's
-- exercises, mirroring the existing per-exercise/per-set checks. Signature is
-- unchanged, so this is a plain create-or-replace; grants are re-issued below
-- anyway to match this file's established pattern for SECURITY DEFINER
-- functions rather than relying on implicit preservation.
create or replace function public.replace_future_gym_workout_plan(
  p_plan_id uuid,
  p_plan_data jsonb
)
returns public.plans
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  target_plan public.plans;
  caller_timezone text;
  caller_today date;
  replacement_exercise jsonb;
  replacement_set jsonb;
  replacement_alternative jsonb;
  revised_plan public.plans;
begin
  if caller is null then
    raise exception 'future Gym plan revision requires an authenticated user';
  end if;

  select timezone into caller_timezone from public.profiles where id = caller;
  if caller_timezone is null then
    raise exception 'profile timezone is required to revise a future Gym plan';
  end if;
  caller_today := (now() at time zone caller_timezone)::date;

  select * into target_plan
  from public.plans
  where id = p_plan_id and user_id = caller
  for update;

  if not found then
    raise exception 'Gym plan was not found for this account';
  end if;
  if target_plan.status <> 'active'
    or target_plan.deleted_at is not null
    or coalesce(target_plan.plan_data ->> 'kind', '') <> 'gym_workout' then
    raise exception 'only accepted active Gym plans can be revised';
  end if;
  if target_plan.scheduled_for is null or target_plan.scheduled_for <= caller_today then
    raise exception 'only a future scheduled Gym plan can be revised';
  end if;

  if jsonb_typeof(p_plan_data) <> 'object'
    or p_plan_data ->> 'kind' <> 'gym_workout'
    or p_plan_data ->> 'schema_version' <> '1'
    or p_plan_data ->> 'scheduled_for' <> target_plan.scheduled_for::text
    or nullif(trim(coalesce(p_plan_data ->> 'title', '')), '') is null
    or jsonb_typeof(p_plan_data -> 'exercises') <> 'array'
    or jsonb_array_length(p_plan_data -> 'exercises') = 0 then
    raise exception 'replacement must be a complete Gym plan for the original scheduled date';
  end if;

  for replacement_exercise in select value from jsonb_array_elements(p_plan_data -> 'exercises') loop
    if jsonb_typeof(replacement_exercise) <> 'object'
      or nullif(trim(coalesce(replacement_exercise ->> 'client_id', '')), '') is null
      or nullif(trim(coalesce(replacement_exercise ->> 'name', '')), '') is null
      or jsonb_typeof(replacement_exercise -> 'sets') <> 'array'
      or jsonb_array_length(replacement_exercise -> 'sets') = 0 then
      raise exception 'each revised exercise needs an id, name, and at least one set';
    end if;
    for replacement_set in select value from jsonb_array_elements(replacement_exercise -> 'sets') loop
      if jsonb_typeof(replacement_set) <> 'object'
        or coalesce(replacement_set ->> 'reps', '') !~ '^[1-9][0-9]*$'
        or (replacement_set ? 'weight_kg' and replacement_set -> 'weight_kg' <> 'null'::jsonb and (jsonb_typeof(replacement_set -> 'weight_kg') <> 'number' or (replacement_set ->> 'weight_kg')::numeric < 0))
        or (replacement_set ? 'rest_seconds' and (coalesce(replacement_set ->> 'rest_seconds', '') !~ '^[0-9]+$')) then
        raise exception 'each revised set requires positive reps and valid nonnegative load/rest values';
      end if;
    end loop;

    if replacement_exercise ? 'alternatives' then
      if jsonb_typeof(replacement_exercise -> 'alternatives') <> 'array'
        or jsonb_array_length(replacement_exercise -> 'alternatives') > 4 then
        raise exception 'each exercise may have at most 4 alternatives';
      end if;
      for replacement_alternative in select value from jsonb_array_elements(replacement_exercise -> 'alternatives') loop
        if jsonb_typeof(replacement_alternative) <> 'object'
          or nullif(trim(coalesce(replacement_alternative ->> 'client_id', '')), '') is null
          or nullif(trim(coalesce(replacement_alternative ->> 'name', '')), '') is null then
          raise exception 'each exercise alternative needs an id and a name';
        end if;
      end loop;
    end if;
  end loop;

  update public.plans
  set user_revision_data = p_plan_data,
      user_revision_updated_at = now()
  where id = target_plan.id and user_id = caller
  returning * into revised_plan;

  return revised_plan;
end;
$$;

revoke execute on function public.replace_future_gym_workout_plan(uuid, jsonb) from public;
revoke execute on function public.replace_future_gym_workout_plan(uuid, jsonb) from anon;
revoke execute on function public.replace_future_gym_workout_plan(uuid, jsonb) from service_role;
grant execute on function public.replace_future_gym_workout_plan(uuid, jsonb) to authenticated;
