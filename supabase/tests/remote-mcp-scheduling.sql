\set ON_ERROR_STOP on

begin;

-- This client_id claim selects the remote OAuth/RPC path. It is deliberately
-- distinct from browser owner access and the local high-trust MCP process.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-4000-8000-0000000000a1',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'remote-schedule@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.agent_authorizations (user_id, agent_identifier, action)
values ('00000000-0000-4000-8000-0000000000a1', 'remote-mcp', 'write_proposed_plan');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000a1', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated","client_id":"remote-scheduling-test"}', true);

do $$
declare
  created jsonb;
begin
  created := public.remote_mcp_create_proposed_plan(
    'Remote scheduling regression fixture',
    '{"kind":"gym_workout","schema_version":1,"scheduled_for":"2026-07-25","title":"Remote schedule fixture","exercises":[{"client_id":"fixture-squat","name":"Fixture squat","sets":[{"reps":5,"weight_kg":null,"rest_seconds":120}]}]}'::jsonb
  );
  if created->>'scheduled_for' <> '2026-07-25' then
    raise exception 'remote gym proposal did not persist scheduled_for: %', created->>'scheduled_for';
  end if;
  if created->>'status' <> 'proposed' or created->>'provenance' <> 'agent_written_plan' or created->>'source_client' <> 'remote-mcp' then
    raise exception 'remote gym proposal violated proposal provenance/status boundary';
  end if;
end;
$$;

rollback;
