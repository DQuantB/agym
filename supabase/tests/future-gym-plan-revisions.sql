\set ON_ERROR_STOP on
begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'revision-owner@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'revision-other@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

update public.profiles set timezone = 'UTC' where id = '00000000-0000-0000-0000-0000000000e1';
insert into public.plans (user_id, raw_plan_text, plan_data, source_client, scheduled_for, status)
values
('00000000-0000-0000-0000-0000000000e1', 'Original agent workout', '{"kind":"gym_workout","schema_version":1,"scheduled_for":"2099-01-02","title":"Original","exercises":[{"client_id":"squat","name":"Squat","sets":[{"reps":5,"weight_kg":60,"rest_seconds":120}]}]}'::jsonb, 'hermes', '2099-01-02', 'active'),
('00000000-0000-0000-0000-0000000000e1', 'Today agent workout', jsonb_build_object('kind','gym_workout','schema_version',1,'scheduled_for',current_date::text,'title','Today','exercises',jsonb_build_array(jsonb_build_object('client_id','row','name','Row','sets',jsonb_build_array(jsonb_build_object('reps',5))))), 'hermes', current_date, 'active');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', true);
select public.replace_future_gym_workout_plan(id, '{"kind":"gym_workout","schema_version":1,"scheduled_for":"2099-01-02","title":"Adjusted","exercises":[{"client_id":"squat","name":"Front squat","sets":[{"reps":4,"weight_kg":65,"rest_seconds":150}]}]}'::jsonb) from public.plans where raw_plan_text = 'Original agent workout';

select public.replace_future_gym_workout_plan(id, '{"kind":"gym_workout","schema_version":1,"scheduled_for":"2099-01-02","title":"Adjusted","exercises":[{"client_id":"squat","name":"Front squat","alternatives":[{"client_id":"back-squat","name":"Back squat"}],"sets":[{"reps":4,"weight_kg":65,"rest_seconds":150}]}]}'::jsonb) from public.plans where raw_plan_text = 'Original agent workout';

do $$ begin
  if not exists (select 1 from public.plans where raw_plan_text = 'Original agent workout' and plan_data->>'title' = 'Original' and user_revision_data->>'title' = 'Adjusted' and status = 'active') then raise exception 'FAIL: owner future revision did not preserve original plan'; end if;
  begin
    update public.plans set plan_data = '{}'::jsonb where raw_plan_text = 'Original agent workout';
    raise exception 'FAIL: browser directly changed agent plan';
  exception when others then raise notice 'PASS: browser direct plan write rejected'; end;
  begin
    perform public.replace_future_gym_workout_plan((select id from public.plans where raw_plan_text = 'Today agent workout'), '{"kind":"gym_workout","schema_version":1,"title":"No","scheduled_for":"2099-01-02","exercises":[]}'::jsonb);
    raise exception 'FAIL: current-day revision accepted';
  exception when others then raise notice 'PASS: current-day revision rejected'; end;
  if not exists (
    select 1 from public.plans
    where raw_plan_text = 'Original agent workout'
      and user_revision_data -> 'exercises' -> 0 -> 'alternatives' = '[{"client_id":"back-squat","name":"Back squat"}]'::jsonb
  ) then raise exception 'FAIL: valid exercise alternatives were not preserved on revision'; end if;
  raise notice 'PASS: valid exercise alternatives preserved on revision';
  begin
    perform public.replace_future_gym_workout_plan(
      (select id from public.plans where raw_plan_text = 'Original agent workout'),
      '{"kind":"gym_workout","schema_version":1,"scheduled_for":"2099-01-02","title":"Blank alternative","exercises":[{"client_id":"squat","name":"Front squat","alternatives":[{"client_id":"back-squat","name":"  "}],"sets":[{"reps":4,"weight_kg":65,"rest_seconds":150}]}]}'::jsonb
    );
    raise exception 'FAIL: revision with a blank-name alternative was accepted';
  exception when others then raise notice 'PASS: blank-name alternative rejected'; end;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e2', true);
do $$ begin
  begin
    perform public.replace_future_gym_workout_plan((select id from public.plans where raw_plan_text = 'Original agent workout'), '{"kind":"gym_workout","schema_version":1,"scheduled_for":"2099-01-02","title":"Other","exercises":[{"client_id":"squat","name":"Squat","sets":[{"reps":5}]}]}'::jsonb);
    raise exception 'FAIL: cross-user revision accepted';
  exception when others then raise notice 'PASS: cross-user revision rejected'; end;
end $$;
rollback;
