-- Verifies create_manual_gym_plan (in-app, non-AI workout creation): shape
-- validation, future-or-today scheduling, immediate accept/supersede via the
-- same core used by every other acceptance path, and owner scoping.
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'manual-plan@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());
update public.profiles set timezone = 'UTC' where id = '00000000-0000-0000-0000-0000000000f1';

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', true);

select public.create_manual_gym_plan(
  '{"kind":"gym_workout","schema_version":1,"scheduled_for":"2099-01-01","title":"Push day","exercises":[{"client_id":"bench","name":"Bench press","sets":[{"reps":5,"weight_kg":80,"rest_seconds":120}]}]}'::jsonb,
  '2099-01-01'
);

select case when count(*) = 1 then 'PASS: manual plan is stored as active with the correct source_client' else 'FAIL: manual plan not stored correctly' end
from public.plans where user_id = '00000000-0000-0000-0000-0000000000f1' and source_client = 'agym-manual-entry' and status = 'active' and scheduled_for = '2099-01-01';

do $$ begin
  begin
    perform public.create_manual_gym_plan('{"kind":"gym_workout","schema_version":1,"title":"No exercises","exercises":[]}'::jsonb, '2099-01-01');
    raise exception 'FAIL: a plan with no exercises was accepted';
  exception when others then
    if position('FAIL:' in SQLERRM) > 0 then raise; end if;
    raise notice 'PASS: a plan with no exercises is rejected';
  end;
  begin
    perform public.create_manual_gym_plan('{"kind":"gym_workout","schema_version":1,"title":"Past","exercises":[{"client_id":"a","name":"A","sets":[{"reps":5}]}]}'::jsonb, '2020-01-01');
    raise exception 'FAIL: a past-dated manual plan was accepted';
  exception when others then
    if position('FAIL:' in SQLERRM) > 0 then raise; end if;
    raise notice 'PASS: a past-dated manual plan is rejected';
  end;
  begin
    perform public.create_manual_gym_plan('{"kind":"gym_workout","schema_version":1,"title":"Bad set","exercises":[{"client_id":"a","name":"A","sets":[{"reps":0}]}]}'::jsonb, '2099-01-01');
    raise exception 'FAIL: a set with zero reps was accepted';
  exception when others then
    if position('FAIL:' in SQLERRM) > 0 then raise; end if;
    raise notice 'PASS: a set with zero reps is rejected';
  end;
end $$;

-- A second manual plan for the same date supersedes the first, exactly like
-- an AI-proposed plan's acceptance would.
select public.create_manual_gym_plan(
  '{"kind":"gym_workout","schema_version":1,"scheduled_for":"2099-01-01","title":"Push day v2","exercises":[{"client_id":"bench","name":"Bench press","sets":[{"reps":5,"weight_kg":85,"rest_seconds":120}]}]}'::jsonb,
  '2099-01-01'
);
select case when count(*) = 1 then 'PASS: same-date manual plan supersedes the previous one' else 'FAIL: same-date supersession' end
from public.plans where user_id = '00000000-0000-0000-0000-0000000000f1' and status = 'superseded' and plan_data ->> 'title' = 'Push day';
select case when count(*) = 1 then 'PASS: exactly one active plan remains for the date' else 'FAIL: active plan count after supersession' end
from public.plans where user_id = '00000000-0000-0000-0000-0000000000f1' and status = 'active' and scheduled_for = '2099-01-01';

reset role;
rollback;
