\set ON_ERROR_STOP on

begin;

-- Create two confirmed Supabase Auth identities. The auth trigger must create
-- their matching public profile rows without a browser choosing profile IDs.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alpha-owner@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'beta-user@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

select case when count(*) = 2 then 'PASS: auth trigger created two profiles' else 'FAIL: profile trigger count' end as profile_trigger_test
from public.profiles
where id in ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002');

-- User A can create their own raw log.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
insert into public.raw_logs (user_id, raw_text) values ('00000000-0000-0000-0000-000000000001', 'Owner A private log');
select case when count(*) = 1 then 'PASS: owner reads own raw log' else 'FAIL: owner cannot read own raw log' end as owner_read_test
from public.raw_logs;

-- Raw source evidence is immutable from the browser: account deletion/soft-delete
-- will later use a separate audited server path, not a direct client DELETE.
do $$
begin
  begin
    delete from public.raw_logs where user_id = '00000000-0000-0000-0000-000000000001';
    raise exception 'FAIL: raw-log delete unexpectedly succeeded';
  exception when insufficient_privilege then
    raise notice 'PASS: raw-log delete rejected by RLS';
  end;
end;
$$;
reset role;

-- User B cannot see User A's log, cannot insert as User A, and cannot read A's authorization.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select case when count(*) = 0 then 'PASS: tenant isolation hides owner log' else 'FAIL: cross-user raw log read' end as cross_user_read_test
from public.raw_logs;

select case when count(*) = 0 then 'PASS: tenant isolation hides owner profile' else 'FAIL: cross-user profile read' end as cross_user_profile_test
from public.profiles
where id = '00000000-0000-0000-0000-000000000001';

-- An RLS policy with WITH CHECK must reject this write. Catch the expected error
-- so the script can continue and prove it did not create a row.
do $$
begin
  begin
    insert into public.raw_logs (user_id, raw_text) values ('00000000-0000-0000-0000-000000000001', 'Cross-user write attempt');
    raise exception 'FAIL: cross-user insert unexpectedly succeeded';
  exception when insufficient_privilege then
    raise notice 'PASS: cross-user insert rejected by RLS';
  end;
  begin
    insert into public.parse_drafts (user_id, raw_log_id, event_type, parse_status)
    values ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'workout', 'parsed');
    raise exception 'FAIL: browser parse-draft insert unexpectedly succeeded';
  exception when insufficient_privilege then
    raise notice 'PASS: browser parse-draft insert rejected';
  end;
  begin
    insert into public.plans (user_id, raw_plan_text, source_client)
    values ('00000000-0000-0000-0000-000000000002', 'Do five squats', 'browser');
    raise exception 'FAIL: browser plan insert unexpectedly succeeded';
  exception when insufficient_privilege then
    raise notice 'PASS: browser plan insert rejected';
  end;
end;
$$;
reset role;

select case when count(*) = 1 then 'PASS: no cross-user row was created' else 'FAIL: cross-user row exists' end as cross_user_write_test
from public.raw_logs
where user_id = '00000000-0000-0000-0000-000000000001';

rollback;
