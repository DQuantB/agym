\set ON_ERROR_STOP on
begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'accept-owner@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'accept-other@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.plans (user_id, raw_plan_text, plan_data, source_client, scheduled_for)
values
  ('00000000-0000-0000-0000-0000000000d1', 'Owner gym proposal', '{"kind":"gym_workout","schema_version":1}'::jsonb, 'hermes', current_date),
  ('00000000-0000-0000-0000-0000000000d1', 'Owner non-gym proposal', '{}'::jsonb, 'hermes', current_date),
  ('00000000-0000-0000-0000-0000000000d2', 'Other gym proposal', '{"kind":"gym_workout","schema_version":1}'::jsonb, 'hermes', current_date);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', true);

select public.accept_gym_workout_plan(id)
from public.plans where user_id = '00000000-0000-0000-0000-0000000000d1' and raw_plan_text = 'Owner gym proposal';
select case when status = 'active' then 'PASS: owner accepts own gym proposal' else 'FAIL: owner acceptance' end
from public.plans where user_id = '00000000-0000-0000-0000-0000000000d1' and raw_plan_text = 'Owner gym proposal';

do $$ begin
  begin
    update public.plans set status = 'active' where raw_plan_text = 'Owner non-gym proposal';
    raise exception 'FAIL: browser directly updated plan status';
  exception when others then raise notice 'PASS: browser direct plan update rejected';
  end;
  begin
    perform public.accept_gym_workout_plan((select id from public.plans where raw_plan_text = 'Owner gym proposal'));
    raise exception 'FAIL: repeated acceptance succeeded';
  exception when others then raise notice 'PASS: repeated acceptance rejected';
  end;
  begin
    perform public.accept_gym_workout_plan((select id from public.plans where raw_plan_text = 'Owner non-gym proposal'));
    raise exception 'FAIL: non-gym acceptance succeeded';
  exception when others then raise notice 'PASS: non-gym acceptance rejected';
  end;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d2', true);
do $$ begin
  begin
    perform public.accept_gym_workout_plan((select id from public.plans where raw_plan_text = 'Owner gym proposal'));
    raise exception 'FAIL: cross-user acceptance succeeded';
  exception when others then raise notice 'PASS: cross-user acceptance rejected';
  end;
end $$;

rollback;
