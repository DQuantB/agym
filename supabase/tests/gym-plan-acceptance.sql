\set ON_ERROR_STOP on
begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'accept-owner@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'accept-other@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.plans (user_id, raw_plan_text, plan_data, source_client, scheduled_for)
values
  ('00000000-0000-0000-0000-0000000000d1', 'Owner gym proposal', '{"kind":"gym_workout","schema_version":1,"title":"First"}'::jsonb, 'hermes', current_date),
  ('00000000-0000-0000-0000-0000000000d1', 'Owner non-gym proposal', '{}'::jsonb, 'hermes', current_date),
  ('00000000-0000-0000-0000-0000000000d1', 'Owner second same-date gym proposal', '{"kind":"gym_workout","schema_version":1,"title":"Second"}'::jsonb, 'hermes', current_date),
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

-- Accepting a second same-date gym proposal must supersede the first rather
-- than leaving two active rows for the same day.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', true);
select public.accept_gym_workout_plan(id) -> 'superseded' ->> 'title' as superseded_title
from public.plans where raw_plan_text = 'Owner second same-date gym proposal' \gset

select case when :'superseded_title' = 'First' then 'PASS: accept reports the superseded plan title' else 'FAIL: accept did not report the superseded plan title (got ' || :'superseded_title' || ')' end;

do $$ begin
  if not exists (select 1 from public.plans where raw_plan_text = 'Owner gym proposal' and status = 'superseded') then
    raise exception 'FAIL: first same-date plan was not superseded';
  end if;
  if not exists (select 1 from public.plans where raw_plan_text = 'Owner second same-date gym proposal' and status = 'active') then
    raise exception 'FAIL: second same-date plan was not activated';
  end if;
  if exists (
    select 1 from public.plans
    where user_id = '00000000-0000-0000-0000-0000000000d1' and scheduled_for = current_date
      and coalesce(plan_data->>'kind','') = 'gym_workout' and status in ('proposed','active')
    group by scheduled_for having count(*) > 1
  ) then raise exception 'FAIL: more than one non-superseded gym plan remains for the date'; end if;
  raise notice 'PASS: same-date supersede leaves exactly one active/proposed gym plan';
end $$;

-- Restoring the superseded plan swaps the pair back.
select public.restore_superseded_gym_plan(id) -> 'superseded' ->> 'title' as restore_superseded_title
from public.plans where raw_plan_text = 'Owner gym proposal' \gset

select case when :'restore_superseded_title' = 'Second' then 'PASS: restore reports the plan it superseded' else 'FAIL: restore did not report the plan it bumped (got ' || :'restore_superseded_title' || ')' end;

do $$ begin
  if not exists (select 1 from public.plans where raw_plan_text = 'Owner gym proposal' and status = 'active') then
    raise exception 'FAIL: restored plan is not active';
  end if;
  if not exists (select 1 from public.plans where raw_plan_text = 'Owner second same-date gym proposal' and status = 'superseded') then
    raise exception 'FAIL: previously-active plan was not superseded by the restore';
  end if;
  begin
    perform public.restore_superseded_gym_plan((select id from public.plans where raw_plan_text = 'Owner gym proposal'));
    raise exception 'FAIL: restoring a non-superseded plan succeeded';
  exception when others then raise notice 'PASS: restoring a non-superseded plan rejected'; end;
  begin
    perform public.restore_superseded_gym_plan((select id from public.plans where raw_plan_text = 'Owner non-gym proposal'));
    raise exception 'FAIL: restoring a non-gym plan succeeded';
  exception when others then raise notice 'PASS: restoring a non-gym plan rejected'; end;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d2', true);
do $$ begin
  begin
    perform public.accept_gym_workout_plan((select id from public.plans where raw_plan_text = 'Owner gym proposal'));
    raise exception 'FAIL: cross-user acceptance succeeded';
  exception when others then raise notice 'PASS: cross-user acceptance rejected';
  end;
  begin
    perform public.restore_superseded_gym_plan((select id from public.plans where raw_plan_text = 'Owner second same-date gym proposal'));
    raise exception 'FAIL: cross-user restore succeeded';
  exception when others then raise notice 'PASS: cross-user restore rejected';
  end;
end $$;

-- Accepting a second gym proposal for the same date supersedes the first
-- acceptance above ('Owner gym proposal' is now active for current_date).
reset role;
insert into public.plans (user_id, raw_plan_text, plan_data, source_client, scheduled_for)
values
  ('00000000-0000-0000-0000-0000000000d1', 'Owner replacement gym proposal', '{"kind":"gym_workout","schema_version":1}'::jsonb, 'hermes', current_date),
  ('00000000-0000-0000-0000-0000000000d1', 'Owner other-day gym proposal', '{"kind":"gym_workout","schema_version":1}'::jsonb, 'hermes', current_date + 1),
  ('00000000-0000-0000-0000-0000000000d1', 'Owner other-category proposal', '{"kind":"run_workout","schema_version":1}'::jsonb, 'hermes', current_date);
update public.plans set status = 'active' where raw_plan_text = 'Owner other-category proposal';

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', true);

select public.accept_gym_workout_plan(id)
from public.plans where user_id = '00000000-0000-0000-0000-0000000000d1' and raw_plan_text = 'Owner replacement gym proposal';

select case when status = 'superseded' then 'PASS: same-day same-category active plan is superseded' else 'FAIL: prior active plan not superseded, status=' || status end
from public.plans where raw_plan_text = 'Owner gym proposal';
select case when status = 'active' then 'PASS: newly accepted plan becomes active' else 'FAIL: replacement plan status=' || status end
from public.plans where raw_plan_text = 'Owner replacement gym proposal';
select case when status = 'active' then 'PASS: different-category active plan on the same day is untouched' else 'FAIL: other-category plan status=' || status end
from public.plans where raw_plan_text = 'Owner other-category proposal';

select public.accept_gym_workout_plan(id)
from public.plans where user_id = '00000000-0000-0000-0000-0000000000d1' and raw_plan_text = 'Owner other-day gym proposal';
select case when status = 'active' then 'PASS: different-day same-category active plan is untouched' else 'FAIL: other-day plan status=' || status end
from public.plans where raw_plan_text = 'Owner replacement gym proposal';

rollback;
