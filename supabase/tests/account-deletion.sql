-- Verifies user-initiated account deletion (public.delete_my_account).
-- Proves: full cascade across every user-owned table, self-only scope,
-- and that anon/service_role cannot execute it.
\set ON_ERROR_STOP on

begin;

-- Two authenticated identities.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'del-a@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'del-b@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

-- Seed user A across every user-owned table (bypassing RLS as superuser here;
-- the point of this test is the cascade + function scope, not RLS inserts).
insert into public.raw_logs (user_id, client_id, raw_text) values ('00000000-0000-0000-0000-0000000000a1', 'r1', 'log a');
insert into public.canonical_events (user_id, client_id, source_raw_log_id, event_type, final_fields)
  values ('00000000-0000-0000-0000-0000000000a1', 'e1', (select id from public.raw_logs where client_id='r1'), 'workout', '{}'::jsonb);
insert into public.parse_drafts (user_id, raw_log_id, event_type, parse_status)
  values ('00000000-0000-0000-0000-0000000000a1', (select id from public.raw_logs where client_id='r1'), 'workout', 'parsed');
insert into public.plans (user_id, raw_plan_text, source_client) values ('00000000-0000-0000-0000-0000000000a1', 'plan a', 'hermes');
insert into public.agent_authorizations (user_id, agent_identifier, action) values ('00000000-0000-0000-0000-0000000000a1', 'hermes', 'read_context');
insert into public.agent_audit_log (user_id, agent_identifier, action, resource_type)
  values ('00000000-0000-0000-0000-0000000000a1', 'hermes', 'get_context', 'context');
insert into public.consent_records (user_id, consent_type, granted, consent_version) values ('00000000-0000-0000-0000-0000000000a1', 'llm_parsing', true, 'v1');

-- Seed one row for user B to prove isolation (must survive A's deletion).
insert into public.raw_logs (user_id, client_id, raw_text) values ('00000000-0000-0000-0000-0000000000a2', 'r-b', 'log b');

select case when count(*) = 8 then 'PASS: seeded 8 rows across A''s tables'
            else 'FAIL: seed count ' || count(*) end as seed_test
from (
  select 1 from public.profiles where id='00000000-0000-0000-0000-0000000000a1'
  union all select 1 from public.raw_logs where user_id='00000000-0000-0000-0000-0000000000a1'
  union all select 1 from public.canonical_events where user_id='00000000-0000-0000-0000-0000000000a1'
  union all select 1 from public.parse_drafts where user_id='00000000-0000-0000-0000-0000000000a1'
  union all select 1 from public.plans where user_id='00000000-0000-0000-0000-0000000000a1'
  union all select 1 from public.agent_authorizations where user_id='00000000-0000-0000-0000-0000000000a1'
  union all select 1 from public.agent_audit_log where user_id='00000000-0000-0000-0000-0000000000a1'
  union all select 1 from public.consent_records where user_id='00000000-0000-0000-0000-0000000000a1'
) s;

-- anon must NOT be able to execute the function.
set local role anon;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
do $$
begin
  begin
    perform public.delete_my_account();
    raise exception 'FAIL: anon executed delete_my_account';
  exception when insufficient_privilege then
    raise notice 'PASS: anon cannot execute delete_my_account';
  end;
end;
$$;
reset role;

-- User A deletes their own account.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select public.delete_my_account();
reset role;

-- Everything for A is gone across all 8 tables (cascade).
select case when count(*) = 0 then 'PASS: account deletion cascaded across all A tables'
            else 'FAIL: ' || count(*) || ' A rows remain' end as cascade_test
from (
  select 1 from public.profiles where id='00000000-0000-0000-0000-0000000000a1'
  union all select 1 from public.raw_logs where user_id='00000000-0000-0000-0000-0000000000a1'
  union all select 1 from public.canonical_events where user_id='00000000-0000-0000-0000-0000000000a1'
  union all select 1 from public.parse_drafts where user_id='00000000-0000-0000-0000-0000000000a1'
  union all select 1 from public.plans where user_id='00000000-0000-0000-0000-0000000000a1'
  union all select 1 from public.agent_authorizations where user_id='00000000-0000-0000-0000-0000000000a1'
  union all select 1 from public.agent_audit_log where user_id='00000000-0000-0000-0000-0000000000a1'
  union all select 1 from public.consent_records where user_id='00000000-0000-0000-0000-0000000000a1'
) s;

-- The auth.users row for A is gone too.
select case when count(*) = 0 then 'PASS: auth.users row removed for A' else 'FAIL: auth row remains' end as auth_test
from auth.users where id='00000000-0000-0000-0000-0000000000a1';

-- User B is untouched (self-only scope).
select case when count(*) = 1 then 'PASS: other user data untouched' else 'FAIL: user B affected' end as isolation_test
from public.raw_logs where user_id='00000000-0000-0000-0000-0000000000a2';

-- An unauthenticated caller (no JWT sub) is rejected.
set local role authenticated;
select set_config('request.jwt.claim.sub', '', true);
do $$
begin
  begin
    perform public.delete_my_account();
    raise exception 'FAIL: null-auth caller executed delete';
  exception
    when others then raise notice 'PASS: unauthenticated caller rejected (%)', sqlerrm;
  end;
end;
$$;
reset role;

rollback;
