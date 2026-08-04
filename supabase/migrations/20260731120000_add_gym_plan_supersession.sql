-- Accepting a plan for a date that already has an active Gym plan used to
-- leave both rows active -- Home silently picked one (last-write-wins), but
-- Plans showed both as separate cards. This makes acceptance supersede the
-- previous active plan for that date instead: the old row is kept (status
-- 'superseded', never deleted -- it stays queryable via list_plans for
-- training-history tracking) but every existing app query already filters to
-- status in ('proposed','active'), so it disappears from the app for free.
-- A restore RPC lets the owner undo the swap.
--
-- No superseded_by/superseded_at link is needed: once "at most one active
-- gym plan per date" is an invariant (which this migration establishes),
-- "the active plan for this date" is always unambiguous, so both directions
-- of the swap can resolve it by (user_id, scheduled_for, status) alone.

-- Internal only -- shared by the single-id and (future) bulk accept RPCs so
-- the supersede logic lives in exactly one place. Not directly callable:
-- takes p_caller as a plain argument rather than reading auth.uid() itself,
-- so it must only ever be invoked from another SECURITY DEFINER function
-- that has already authenticated the caller -- mirrors gym_plan_conflicts'
-- existing no-grants-to-anyone pattern.
create or replace function public.accept_gym_workout_plan_core(p_caller uuid, p_plan_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  proposed_plan public.plans;
  accepted_plan public.plans;
  previously_active public.plans;
  had_previous boolean;
begin
  select * into proposed_plan
  from public.plans
  where id = p_plan_id and user_id = p_caller
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

  select * into previously_active
  from public.plans
  where user_id = p_caller
    and scheduled_for = proposed_plan.scheduled_for
    and status = 'active'
    and deleted_at is null
    and coalesce(plan_data ->> 'kind', '') = 'gym_workout'
  for update;
  had_previous := found;

  if had_previous then
    update public.plans set status = 'superseded' where id = previously_active.id;
  end if;

  update public.plans
  set status = 'active'
  where id = proposed_plan.id and user_id = p_caller
  returning * into accepted_plan;

  return jsonb_build_object(
    'plan', to_jsonb(accepted_plan),
    'superseded', case when had_previous then jsonb_build_object(
      'id', previously_active.id,
      'title', coalesce(previously_active.user_revision_data ->> 'title', previously_active.plan_data ->> 'title', 'Untitled plan')
    ) else null end
  );
end;
$$;

revoke all on function public.accept_gym_workout_plan_core(uuid, uuid)
  from public, anon, authenticated, service_role;

-- Return type changes from public.plans to jsonb (to carry the superseded
-- envelope), which requires DROP + CREATE rather than a plain
-- create-or-replace. A bare DROP restores Supabase's default EXECUTE grants
-- to anon/authenticated/service_role, so the revoke/grant footer below is
-- not optional -- this function is SECURITY DEFINER and would otherwise let
-- any authenticated session pass an arbitrary plan id from any account.
drop function if exists public.accept_gym_workout_plan(uuid);

create function public.accept_gym_workout_plan(p_plan_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'gym plan acceptance requires an authenticated user';
  end if;
  return public.accept_gym_workout_plan_core(caller, p_plan_id);
end;
$$;

revoke all on function public.accept_gym_workout_plan(uuid)
  from public, anon, service_role;
grant execute on function public.accept_gym_workout_plan(uuid) to authenticated;

create or replace function public.restore_superseded_gym_plan(p_plan_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  target_plan public.plans;
  currently_active public.plans;
  had_active boolean;
  restored_plan public.plans;
begin
  if caller is null then
    raise exception 'restoring a superseded Gym plan requires an authenticated user';
  end if;

  select * into target_plan
  from public.plans
  where id = p_plan_id and user_id = caller
  for update;

  if not found then
    raise exception 'gym plan was not found for this account';
  end if;
  if target_plan.status <> 'superseded' then
    raise exception 'only a superseded Gym plan can be restored';
  end if;
  if target_plan.deleted_at is not null then
    raise exception 'a deleted Gym plan cannot be restored';
  end if;
  if coalesce(target_plan.plan_data ->> 'kind', '') <> 'gym_workout' then
    raise exception 'only structured gym_workout plans can be restored here';
  end if;

  select * into currently_active
  from public.plans
  where user_id = caller
    and scheduled_for = target_plan.scheduled_for
    and status = 'active'
    and deleted_at is null
    and coalesce(plan_data ->> 'kind', '') = 'gym_workout'
  for update;
  had_active := found;

  if had_active then
    update public.plans set status = 'superseded' where id = currently_active.id;
  end if;

  update public.plans
  set status = 'active'
  where id = target_plan.id and user_id = caller
  returning * into restored_plan;

  return jsonb_build_object(
    'plan', to_jsonb(restored_plan),
    'superseded', case when had_active then jsonb_build_object(
      'id', currently_active.id,
      'title', coalesce(currently_active.user_revision_data ->> 'title', currently_active.plan_data ->> 'title', 'Untitled plan')
    ) else null end
  );
end;
$$;

revoke all on function public.restore_superseded_gym_plan(uuid)
  from public, anon, service_role;
grant execute on function public.restore_superseded_gym_plan(uuid) to authenticated;
