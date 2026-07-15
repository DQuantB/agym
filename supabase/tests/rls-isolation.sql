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
insert into public.raw_logs (user_id, client_id, raw_text) values ('00000000-0000-0000-0000-000000000001', 'raw_owner_a', 'Owner A private log');
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

-- Owner-managed MCP permissions are separate per action and retain revocation history.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
insert into public.agent_authorizations (user_id, agent_identifier, action)
values ('00000000-0000-0000-0000-000000000001', 'hermes', 'read_context');

-- Only one active grant may exist for an action. This keeps MCP authorization
-- lookup deterministic while allowing another grant after a later revocation.
do $$
begin
  begin
    insert into public.agent_authorizations (user_id, agent_identifier, action)
    values ('00000000-0000-0000-0000-000000000001', 'hermes', 'read_context');
    raise exception 'FAIL: duplicate active authorization unexpectedly succeeded';
  exception when unique_violation then
    raise notice 'PASS: duplicate active authorization rejected';
  end;
end;
$$;

-- Client identity is part of the active-grant key: two named clients can hold
-- the same action independently, while a duplicate for one named client fails.
insert into public.agent_authorizations (user_id, agent_identifier, action, scope)
values
  ('00000000-0000-0000-0000-000000000001', 'claude-code', 'read_context', '{"limit":14}'::jsonb),
  ('00000000-0000-0000-0000-000000000001', 'codex', 'read_context', '{"limit":14}'::jsonb);

select case when count(*) = 2 then 'PASS: Claude Code and Codex hold independent active read grants' else 'FAIL: named-client active grants are not independent' end as named_client_active_grants_test
from public.agent_authorizations
where user_id = '00000000-0000-0000-0000-000000000001'
  and agent_identifier in ('claude-code', 'codex')
  and action = 'read_context'
  and revoked_at is null;

do $$
begin
  begin
    insert into public.agent_authorizations (user_id, agent_identifier, action)
    values ('00000000-0000-0000-0000-000000000001', 'claude-code', 'read_context');
    raise exception 'FAIL: duplicate active named-client authorization unexpectedly succeeded';
  exception when unique_violation then
    raise notice 'PASS: duplicate active named-client authorization rejected';
  end;
end;
$$;

-- Revocation preserves the original record. Its identity, action, and scope
-- cannot be rewritten, it cannot be un-revoked, and a fresh regrant remains
-- possible without changing the historical evidence.
update public.agent_authorizations
set revoked_at = now()
where user_id = '00000000-0000-0000-0000-000000000001'
  and agent_identifier = 'claude-code'
  and action = 'read_context';

do $$
begin
  begin
    update public.agent_authorizations set agent_identifier = 'codex'
    where user_id = '00000000-0000-0000-0000-000000000001' and agent_identifier = 'claude-code' and action = 'read_context';
    raise exception 'FAIL: revoked authorization identity rewrite unexpectedly succeeded';
  exception when others then
    if SQLERRM <> 'agent authorizations may only be revoked once' then raise; end if;
    raise notice 'PASS: revoked authorization identity is immutable';
  end;
  begin
    update public.agent_authorizations set action = 'write_proposed_plan'
    where user_id = '00000000-0000-0000-0000-000000000001' and agent_identifier = 'claude-code' and action = 'read_context';
    raise exception 'FAIL: revoked authorization action rewrite unexpectedly succeeded';
  exception when others then
    if SQLERRM <> 'agent authorizations may only be revoked once' then raise; end if;
    raise notice 'PASS: revoked authorization action is immutable';
  end;
  begin
    update public.agent_authorizations set scope = '{"limit":50}'::jsonb
    where user_id = '00000000-0000-0000-0000-000000000001' and agent_identifier = 'claude-code' and action = 'read_context';
    raise exception 'FAIL: revoked authorization scope rewrite unexpectedly succeeded';
  exception when others then
    if SQLERRM <> 'agent authorizations may only be revoked once' then raise; end if;
    raise notice 'PASS: revoked authorization scope is immutable';
  end;
  begin
    update public.agent_authorizations set revoked_at = null
    where user_id = '00000000-0000-0000-0000-000000000001' and agent_identifier = 'claude-code' and action = 'read_context';
    raise exception 'FAIL: revoked authorization un-revoke unexpectedly succeeded';
  exception when others then
    if SQLERRM <> 'agent authorizations may only be revoked once' then raise; end if;
    raise notice 'PASS: revoked authorization cannot be un-revoked';
  end;
end;
$$;

insert into public.agent_authorizations (user_id, agent_identifier, action, scope)
values ('00000000-0000-0000-0000-000000000001', 'claude-code', 'read_context', '{"limit":14}'::jsonb);

select case when count(*) = 2 then 'PASS: named-client regrant succeeds after revocation' else 'FAIL: named-client regrant did not create independent active grants' end as named_client_regrant_test
from public.agent_authorizations
where user_id = '00000000-0000-0000-0000-000000000001'
  and agent_identifier in ('claude-code', 'codex')
  and action = 'read_context'
  and revoked_at is null;

select case when count(*) = 2
  and count(*) filter (where revoked_at is not null and scope = '{"limit":14}'::jsonb) = 1
  then 'PASS: revoked named-client history remains intact'
  else 'FAIL: revoked named-client history changed'
end as named_client_history_test
from public.agent_authorizations
where user_id = '00000000-0000-0000-0000-000000000001'
  and agent_identifier = 'claude-code'
  and action = 'read_context';

-- Browser-role callers must not execute the SECURITY DEFINER MCP plan RPC.
do $$
begin
  begin
    perform public.create_mcp_proposed_plan(
      '00000000-0000-0000-0000-000000000001',
      (select id from public.agent_authorizations where user_id = '00000000-0000-0000-0000-000000000001' and action = 'read_context'),
      'hermes',
      'Browser bypass attempt',
      '{}'::jsonb
    );
    raise exception 'FAIL: browser MCP RPC execution unexpectedly succeeded';
  exception when insufficient_privilege then
    raise notice 'PASS: browser MCP RPC execution rejected';
  end;
end;
$$;

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
    insert into public.raw_logs (user_id, client_id, raw_text) values ('00000000-0000-0000-0000-000000000001', 'raw_cross_user_attempt', 'Cross-user write attempt');
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
