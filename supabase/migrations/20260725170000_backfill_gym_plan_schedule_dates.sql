-- Earlier Gym proposals stored their scheduled date only inside plan_data. Persist the
-- same validated date for non-deleted legacy rows so calendar, Home, and workout
-- execution all use one durable schedule field. This does not change plan status,
-- provenance, or plan_data, and leaves malformed legacy values untouched.
do $$
declare
  legacy_plan record;
  parsed_scheduled_for date;
begin
  for legacy_plan in
    select id, plan_data ->> 'scheduled_for' as raw_scheduled_for
    from public.plans
    where scheduled_for is null
      and deleted_at is null
      and coalesce(plan_data ->> 'kind', '') = 'gym_workout'
  loop
    begin
      if legacy_plan.raw_scheduled_for !~ '^\d{4}-\d{2}-\d{2}$' then
        continue;
      end if;
      parsed_scheduled_for := legacy_plan.raw_scheduled_for::date;
    exception when others then
      continue;
    end;

    update public.plans
    set scheduled_for = parsed_scheduled_for
    where id = legacy_plan.id and scheduled_for is null;
  end loop;
end;
$$;
