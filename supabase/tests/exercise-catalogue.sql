\set ON_ERROR_STOP on

begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'catalogue-reader@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.exercise_catalogue (source, source_id, source_commit, name, category, body_part, equipment, muscle_group, secondary_muscles, target, instructions, instruction_steps)
values ('hasaneyldrm/exercises-dataset', '0007', 'test-commit', 'alternate lateral pulldown', 'back', 'back', 'cable', 'biceps', array['biceps','rhomboids'], 'biceps', '{"en":"pull"}'::jsonb, '{"en":["pull"]}'::jsonb);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', true);

select case when count(*) = 1 then 'PASS: authenticated user reads the catalogue' else 'FAIL: catalogue not readable' end as read_test
from public.exercise_catalogue where source_id = '0007';

do $$
begin
  begin
    insert into public.exercise_catalogue (source, source_id, source_commit, name, category, body_part, equipment, muscle_group, secondary_muscles, target, instructions, instruction_steps)
    values ('x', '9999', 'x', 'browser insert attempt', 'back', 'back', 'cable', 'biceps', array[]::text[], 'biceps', '{}'::jsonb, '{}'::jsonb);
    raise exception 'FAIL: browser insert into exercise_catalogue unexpectedly succeeded';
  exception when insufficient_privilege then
    raise notice 'PASS: browser insert into exercise_catalogue rejected';
  end;
  begin
    update public.exercise_catalogue set name = 'rewritten' where source_id = '0007';
    raise exception 'FAIL: browser update of exercise_catalogue unexpectedly succeeded';
  exception when insufficient_privilege then
    raise notice 'PASS: browser update of exercise_catalogue rejected';
  end;
  begin
    delete from public.exercise_catalogue where source_id = '0007';
    raise exception 'FAIL: browser delete of exercise_catalogue unexpectedly succeeded';
  exception when insufficient_privilege then
    raise notice 'PASS: browser delete of exercise_catalogue rejected';
  end;
end;
$$;

reset role;

set local role service_role;
update public.exercise_catalogue set name = 'rewritten by importer' where source_id = '0007';
select case when count(*) = 1 then 'PASS: service_role (import script) can write the catalogue' else 'FAIL: service_role cannot write the catalogue' end as importer_write_test
from public.exercise_catalogue where source_id = '0007' and name = 'rewritten by importer';
reset role;

rollback;
