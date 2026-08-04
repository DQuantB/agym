\set ON_ERROR_STOP on
begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bulk-owner@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bulk-other@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.plans (user_id, raw_plan_text, plan_data, source_client, scheduled_for, status)
values
  ('00000000-0000-0000-0000-0000000000c1', 'Mon', '{"kind":"gym_workout","schema_version":1,"title":"Mon"}'::jsonb, 'hermes', current_date + 1, 'proposed'),
  ('00000000-0000-0000-0000-0000000000c1', 'Wed', '{"kind":"gym_workout","schema_version":1,"title":"Wed"}'::jsonb, 'hermes', current_date + 3, 'proposed'),
  ('00000000-0000-0000-0000-0000000000c1', 'Fri', '{"kind":"gym_workout","schema_version":1,"title":"Fri"}'::jsonb, 'hermes', current_date + 5, 'proposed'),
  ('00000000-0000-0000-0000-0000000000c1', 'AlreadyActive', '{"kind":"gym_workout","schema_version":1,"title":"AlreadyActive"}'::jsonb, 'hermes', current_date + 7, 'active'),
  ('00000000-0000-0000-0000-0000000000c1', 'MixedValid', '{"kind":"gym_workout","schema_version":1,"title":"MixedValid"}'::jsonb, 'hermes', current_date + 8, 'proposed'),
  ('00000000-0000-0000-0000-0000000000c1', 'SameDayA', '{"kind":"gym_workout","schema_version":1,"title":"SameDayA"}'::jsonb, 'hermes', current_date + 9, 'proposed'),
  ('00000000-0000-0000-0000-0000000000c1', 'SameDayB', '{"kind":"gym_workout","schema_version":1,"title":"SameDayB"}'::jsonb, 'hermes', current_date + 9, 'proposed'),
  ('00000000-0000-0000-0000-0000000000c2', 'OtherOwner', '{"kind":"gym_workout","schema_version":1,"title":"OtherOwner"}'::jsonb, 'hermes', current_date + 1, 'proposed');

-- Capture every id needed below while still unauthenticated (bypasses RLS),
-- so no later query has to read across the owner-scoped RLS boundary --
-- the same pitfall documented earlier in this repo's other plan test files.
select id as mon_id from public.plans where raw_plan_text = 'Mon' \gset
select id as wed_id from public.plans where raw_plan_text = 'Wed' \gset
select id as fri_id from public.plans where raw_plan_text = 'Fri' \gset
select id as already_active_id from public.plans where raw_plan_text = 'AlreadyActive' \gset
select id as mixed_valid_id from public.plans where raw_plan_text = 'MixedValid' \gset
select id as same_day_a_id from public.plans where raw_plan_text = 'SameDayA' \gset
select id as same_day_b_id from public.plans where raw_plan_text = 'SameDayB' \gset
select id as other_owner_id from public.plans where raw_plan_text = 'OtherOwner' \gset

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);

-- Three different-date proposals accepted in one call all succeed.
select public.accept_gym_workout_plans(array[:'mon_id'::uuid, :'wed_id'::uuid, :'fri_id'::uuid]) -> 'results' as three_day_results \gset

select case when jsonb_array_length(:'three_day_results'::jsonb) = 3
  and (select bool_and((item ->> 'ok')::boolean) from jsonb_array_elements(:'three_day_results'::jsonb) as item)
  then 'PASS: three different-date proposals all accepted in one call'
  else 'FAIL: three different-date proposals did not all report ok=true' end;

do $$ begin
  if (select count(*) from public.plans where user_id = '00000000-0000-0000-0000-0000000000c1' and raw_plan_text in ('Mon','Wed','Fri') and status = 'active') <> 3 then
    raise exception 'FAIL: not all three different-date plans ended up active';
  end if;
  raise notice 'PASS: three different-date plans are all active after one bulk call';
end $$;

-- A batch containing one already-actioned id reports that item's own
-- failure without aborting the other, valid, item in the same batch.
select public.accept_gym_workout_plans(array[:'already_active_id'::uuid, :'mixed_valid_id'::uuid]) -> 'results' as mixed_results \gset

select case when (
    select bool_and(
      case (item ->> 'id')
        when :'already_active_id' then (item ->> 'ok')::boolean = false
        when :'mixed_valid_id' then (item ->> 'ok')::boolean = true
        else false
      end
    ) from jsonb_array_elements(:'mixed_results'::jsonb) as item
  ) then 'PASS: one bad id in a batch fails independently while the valid id still succeeds'
  else 'FAIL: mixed-validity batch did not report per-item outcomes correctly' end;

-- Two ids in the same batch sharing a date: the later one in array order
-- ends up active, the earlier one gets superseded -- same rule as two
-- separate accept calls for the same date.
select public.accept_gym_workout_plans(array[:'same_day_b_id'::uuid, :'same_day_a_id'::uuid]) \gset

do $$ begin
  if not exists (select 1 from public.plans where raw_plan_text = 'SameDayA' and status = 'active') then
    raise exception 'FAIL: SameDayA is not active after the same-date batch';
  end if;
  if not exists (select 1 from public.plans where raw_plan_text = 'SameDayB' and status = 'superseded') then
    raise exception 'FAIL: SameDayB was not superseded by the same-date batch';
  end if;
  raise notice 'PASS: two same-date ids in one batch leave exactly one active, matching two separate accept calls';
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c2', true);
select public.accept_gym_workout_plans(array[:'other_owner_id'::uuid, :'mon_id'::uuid]) -> 'results' as cross_owner_results \gset

select case when (
    select bool_and(
      case (item ->> 'id')
        when :'other_owner_id' then (item ->> 'ok')::boolean = true
        when :'mon_id' then (item ->> 'ok')::boolean = false
        else false
      end
    ) from jsonb_array_elements(:'cross_owner_results'::jsonb) as item
  ) then 'PASS: bulk-accept only ever actions the caller''s own plans'
  else 'FAIL: bulk-accept let one caller action another owner''s plan' end;

rollback;
