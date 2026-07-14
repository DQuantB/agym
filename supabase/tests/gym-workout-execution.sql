\set ON_ERROR_STOP on
begin;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'workout-owner@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'workout-other@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.plans (user_id, raw_plan_text, plan_data, source_client, scheduled_for)
values
  ('00000000-0000-0000-0000-0000000000c1', 'Agent workout proposal', '{"kind":"gym_workout","schema_version":1}'::jsonb, 'hermes', current_date),
  ('00000000-0000-0000-0000-0000000000c2', 'Other workout proposal', '{"kind":"gym_workout","schema_version":1}'::jsonb, 'hermes', current_date);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);

insert into public.workout_executions (user_id, plan_id, scheduled_for, planned_snapshot, execution_data)
values (
  '00000000-0000-0000-0000-0000000000c1',
  (select id from public.plans where user_id = '00000000-0000-0000-0000-0000000000c1'),
  current_date,
  '{"kind":"gym_workout","exercises":[{"name":"Squat","sets":[{"reps":5,"weight_kg":60}]}]}'::jsonb,
  '{"kind":"gym_workout","exercises":[{"name":"Squat","sets":[{"reps":6,"weight_kg":62.5,"completed":true}]}]}'::jsonb
);

select case when count(*) = 1 then 'PASS: owner starts workout execution' else 'FAIL: owner start' end
from public.workout_executions;

update public.workout_executions set additional_notes = 'Felt stable' where user_id = '00000000-0000-0000-0000-0000000000c1';
select case when additional_notes = 'Felt stable' then 'PASS: owner updates actual notes' else 'FAIL: owner update' end
from public.workout_executions where user_id = '00000000-0000-0000-0000-0000000000c1';

do $$ begin
  begin
    update public.workout_executions set planned_snapshot = '{}'::jsonb;
    raise exception 'FAIL: baseline mutation unexpectedly succeeded';
  exception when others then
    raise notice 'PASS: baseline mutation rejected';
  end;
  begin
    -- A client-controlled custom setting must not bypass the RLS completion gate.
    perform set_config('agym.complete_workout_execution', 'on', true);
    update public.workout_executions set status = 'completed', completed_at = now();
    raise exception 'FAIL: browser completion unexpectedly succeeded';
  exception when others then
    raise notice 'PASS: browser completion rejected';
  end;
end $$;

select public.complete_gym_workout_execution(id)
from public.workout_executions where user_id = '00000000-0000-0000-0000-0000000000c1';

select case when count(*) = 1 then 'PASS: completion created linked canonical event' else 'FAIL: canonical event missing' end
from public.canonical_events where user_id = '00000000-0000-0000-0000-0000000000c1' and event_type = 'workout_execution';
select case when count(*) = 1 then 'PASS: completion created immutable raw execution log' else 'FAIL: raw log missing' end
from public.raw_logs where user_id = '00000000-0000-0000-0000-0000000000c1' and source_hint = 'workout';
select case when status = 'completed' and completed_at is not null then 'PASS: execution completed once' else 'FAIL: execution status' end
from public.workout_executions where user_id = '00000000-0000-0000-0000-0000000000c1';

do $$ begin
  begin
    perform public.complete_gym_workout_execution((select id from public.workout_executions where user_id = '00000000-0000-0000-0000-0000000000c1'));
    raise exception 'FAIL: duplicate completion unexpectedly succeeded';
  exception when others then
    raise notice 'PASS: duplicate completion rejected';
  end;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c2', true);
select case when count(*) = 0 then 'PASS: other user cannot read execution' else 'FAIL: cross-user execution visible' end
from public.workout_executions;
do $$ declare owner_execution_id uuid;
begin
  select id into owner_execution_id
  from public.workout_executions
  where user_id = '00000000-0000-0000-0000-0000000000c1'
  limit 1;
  begin
    perform public.complete_gym_workout_execution(owner_execution_id);
    raise exception 'FAIL: cross-user completion unexpectedly succeeded';
  exception when others then
    raise notice 'PASS: cross-user completion rejected';
  end;
end $$;

rollback;
