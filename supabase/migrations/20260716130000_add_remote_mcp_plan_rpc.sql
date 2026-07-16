-- Remote MCP uses the authenticated OAuth user, never a caller-supplied user ID.
-- The legacy service-role RPC remains for local stdio compatibility.
create or replace function public.create_remote_mcp_proposed_plan(
  p_authorization_id uuid,
  p_agent_identifier text,
  p_raw_plan_text text,
  p_plan_data jsonb default '{}'::jsonb
)
returns public.plans
language plpgsql
security definer
set search_path = ''
as $$
declare
  authenticated_user_id uuid := auth.uid();
  created_plan public.plans;
begin
  if authenticated_user_id is null then
    raise exception 'authenticated user required';
  end if;
  if length(trim(p_raw_plan_text)) = 0 then
    raise exception 'plan text must not be blank';
  end if;

  if not exists (
    select 1 from public.agent_authorizations
    where id = p_authorization_id
      and user_id = authenticated_user_id
      and agent_identifier = p_agent_identifier
      and action = 'write_proposed_plan'
      and revoked_at is null
  ) then
    raise exception 'no active write_proposed_plan authorization exists';
  end if;

  insert into public.plans (user_id, raw_plan_text, plan_data, source_client)
  values (authenticated_user_id, p_raw_plan_text, coalesce(p_plan_data, '{}'::jsonb), p_agent_identifier)
  returning * into created_plan;

  insert into public.agent_audit_log (
    user_id, authorization_id, agent_identifier, action, resource_type, resource_id, metadata
  ) values (
    authenticated_user_id, p_authorization_id, p_agent_identifier, 'create_proposed_plan', 'plan', created_plan.id,
    jsonb_build_object('plan_status', created_plan.status, 'source_client', p_agent_identifier,
      'plan_data_present', p_plan_data <> '{}'::jsonb, 'raw_plan_text_length', length(p_raw_plan_text))
  );

  return created_plan;
end;
$$;

revoke execute on function public.create_remote_mcp_proposed_plan(uuid, text, text, jsonb) from public;
revoke execute on function public.create_remote_mcp_proposed_plan(uuid, text, text, jsonb) from anon;
grant execute on function public.create_remote_mcp_proposed_plan(uuid, text, text, jsonb) to authenticated;

-- The remote request uses the user's verified bearer token. This append-only
-- policy lets bounded reads record an audit event without browser write access.
create policy "authenticated MCP audit insert is owner scoped" on public.agent_audit_log
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
grant insert on public.agent_audit_log to authenticated;
