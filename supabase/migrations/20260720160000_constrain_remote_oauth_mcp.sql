-- Native Supabase OAuth access tokens carry client_id. They are valid AGym user
-- tokens, but an OAuth-connected MCP client must not use PostgREST directly to
-- bypass AGym's independently revocable per-action grants.
--
-- Browser sessions do not carry client_id and retain the existing owner RLS
-- surface. Tokens carrying client_id are denied direct table access and may use
-- only the remote_mcp_* security-definer RPCs below.
create or replace function public.is_remote_mcp_oauth_token()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'client_id', '') <> ''
$$;

-- A restrictive policy combines with every existing owner policy. It closes all
-- direct PostgREST access for a bearer token carrying client_id without changing
-- browser owner flows. SECURITY DEFINER RPCs below remain the constrained remote
-- path and perform their own auth.uid/client_id/grant checks.
create policy "OAuth MCP clients cannot use AGym tables directly" on public.profiles
  as restrictive for all to authenticated
  using (not public.is_remote_mcp_oauth_token())
  with check (not public.is_remote_mcp_oauth_token());
create policy "OAuth MCP clients cannot use raw logs directly" on public.raw_logs
  as restrictive for all to authenticated
  using (not public.is_remote_mcp_oauth_token())
  with check (not public.is_remote_mcp_oauth_token());
create policy "OAuth MCP clients cannot use parse drafts directly" on public.parse_drafts
  as restrictive for all to authenticated
  using (not public.is_remote_mcp_oauth_token())
  with check (not public.is_remote_mcp_oauth_token());
create policy "OAuth MCP clients cannot use canonical events directly" on public.canonical_events
  as restrictive for all to authenticated
  using (not public.is_remote_mcp_oauth_token())
  with check (not public.is_remote_mcp_oauth_token());
create policy "OAuth MCP clients cannot use plans directly" on public.plans
  as restrictive for all to authenticated
  using (not public.is_remote_mcp_oauth_token())
  with check (not public.is_remote_mcp_oauth_token());
create policy "OAuth MCP clients cannot use consent records directly" on public.consent_records
  as restrictive for all to authenticated
  using (not public.is_remote_mcp_oauth_token())
  with check (not public.is_remote_mcp_oauth_token());
create policy "OAuth MCP clients cannot use grants directly" on public.agent_authorizations
  as restrictive for all to authenticated
  using (not public.is_remote_mcp_oauth_token())
  with check (not public.is_remote_mcp_oauth_token());
create policy "OAuth MCP clients cannot use audit records directly" on public.agent_audit_log
  as restrictive for all to authenticated
  using (not public.is_remote_mcp_oauth_token())
  with check (not public.is_remote_mcp_oauth_token());

create or replace function public.remote_mcp_authorization(
  p_action public.agym_authorization_action
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  authenticated_user_id uuid := auth.uid();
  active_authorization_id uuid;
begin
  if authenticated_user_id is null or not public.is_remote_mcp_oauth_token() then
    raise exception 'remote MCP OAuth token required';
  end if;

  select id into active_authorization_id
  from public.agent_authorizations
  where user_id = authenticated_user_id
    and agent_identifier = 'remote-mcp'
    and action = p_action
    and revoked_at is null
  limit 1;

  if active_authorization_id is null then
    insert into public.agent_audit_log (user_id, agent_identifier, action, resource_type, metadata)
    values (authenticated_user_id, 'remote-mcp', 'denied_' || p_action::text, 'authorization',
      jsonb_build_object('reason', 'no_active_grant', 'required_action', p_action));
    return null;
  end if;
  return active_authorization_id;
end;
$$;

create or replace function public.remote_mcp_get_context(
  p_from_date date default null,
  p_to_date date default null,
  p_limit integer default 14,
  p_include_raw_notes boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  authenticated_user_id uuid := auth.uid();
  active_authorization_id uuid;
  result jsonb;
begin
  if p_limit < 1 or p_limit > 50 then raise exception 'limit must be between 1 and 50'; end if;
  if p_from_date is not null and p_to_date is not null and p_from_date > p_to_date then
    raise exception 'from_date must not be after to_date';
  end if;
  active_authorization_id := public.remote_mcp_authorization('read_context');
  if active_authorization_id is null then
    return jsonb_build_object('error', 'No active read_context authorization exists for remote-mcp.');
  end if;

  select jsonb_build_object(
    'confirmed_events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', event.client_id, 'confirmed_at', event.confirmed_at,
        'event_type', event.event_type, 'provenance', 'user_confirmed', 'data', event.final_fields
      ) order by event.confirmed_at desc)
      from (
        select id::text as client_id, event_type, final_fields, confirmed_at
        from public.canonical_events
        where user_id = authenticated_user_id and deleted_at is null
          and (p_from_date is null or confirmed_at >= p_from_date::timestamptz)
          and (p_to_date is null or confirmed_at < (p_to_date + 1)::timestamptz)
        order by confirmed_at desc limit p_limit
      ) event
    ), '[]'::jsonb),
    'raw_notes', case when p_include_raw_notes then coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', log.client_id, 'logged_at', log.created_at, 'logged_for_date', log.logged_for_date,
        'text', log.raw_text, 'provenance', 'raw_self_report', 'interpretation_status', 'unparsed'
      ) order by log.created_at desc)
      from (
        select id::text as client_id, raw_text, logged_for_date, created_at
        from public.raw_logs
        where user_id = authenticated_user_id and deleted_at is null
          and (p_from_date is null or logged_for_date >= p_from_date)
          and (p_to_date is null or logged_for_date <= p_to_date)
        order by created_at desc limit p_limit
      ) log
    ), '[]'::jsonb) else '[]'::jsonb end
  ) into result;

  insert into public.agent_audit_log (user_id, authorization_id, agent_identifier, action, resource_type, metadata)
  values (authenticated_user_id, active_authorization_id, 'remote-mcp', 'get_context', 'context',
    jsonb_build_object('from_date', p_from_date, 'to_date', p_to_date, 'limit', p_limit, 'raw_notes_included', p_include_raw_notes));
  return result;
end;
$$;

create or replace function public.remote_mcp_list_plans(
  p_status public.agym_plan_status default null,
  p_limit integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  authenticated_user_id uuid := auth.uid();
  active_authorization_id uuid;
  result jsonb;
begin
  if p_limit < 1 or p_limit > 50 then raise exception 'limit must be between 1 and 50'; end if;
  active_authorization_id := public.remote_mcp_authorization('read_context');
  if active_authorization_id is null then
    return jsonb_build_object('error', 'No active read_context authorization exists for remote-mcp.');
  end if;
  select coalesce(jsonb_agg(to_jsonb(plan) order by plan.created_at desc), '[]'::jsonb) into result
  from (
    select id, raw_plan_text, plan_data, provenance, status, source_client, created_at, updated_at
    from public.plans
    where user_id = authenticated_user_id and deleted_at is null
      and (p_status is null or status = p_status)
    order by created_at desc limit p_limit
  ) plan;
  insert into public.agent_audit_log (user_id, authorization_id, agent_identifier, action, resource_type, metadata)
  values (authenticated_user_id, active_authorization_id, 'remote-mcp', 'list_plans', 'plan',
    jsonb_build_object('status', p_status, 'limit', p_limit, 'plan_count', jsonb_array_length(result)));
  return result;
end;
$$;

create or replace function public.remote_mcp_create_proposed_plan(
  p_raw_plan_text text,
  p_plan_data jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  authenticated_user_id uuid := auth.uid();
  active_authorization_id uuid;
  created_plan public.plans;
begin
  if length(trim(p_raw_plan_text)) = 0 then raise exception 'plan text must not be blank'; end if;
  active_authorization_id := public.remote_mcp_authorization('write_proposed_plan');
  if active_authorization_id is null then
    return jsonb_build_object('error', 'No active write_proposed_plan authorization exists for remote-mcp.');
  end if;
  insert into public.plans (user_id, raw_plan_text, plan_data, source_client)
  values (authenticated_user_id, p_raw_plan_text, coalesce(p_plan_data, '{}'::jsonb), 'remote-mcp')
  returning * into created_plan;
  insert into public.agent_audit_log (user_id, authorization_id, agent_identifier, action, resource_type, resource_id, metadata)
  values (authenticated_user_id, active_authorization_id, 'remote-mcp', 'create_proposed_plan', 'plan', created_plan.id,
    jsonb_build_object('plan_status', created_plan.status, 'source_client', 'remote-mcp',
      'plan_data_present', p_plan_data <> '{}'::jsonb, 'raw_plan_text_length', length(p_raw_plan_text)));
  return to_jsonb(created_plan);
end;
$$;

-- Supersede the earlier remote plan RPC, which accepted grant/agent identifiers
-- from the client. The remote RPCs derive all identity and authorization state.
revoke execute on function public.create_remote_mcp_proposed_plan(uuid, text, text, jsonb) from authenticated;
revoke execute on function public.remote_mcp_authorization(public.agym_authorization_action) from public, anon;
revoke execute on function public.remote_mcp_get_context(date, date, integer, boolean) from public, anon;
revoke execute on function public.remote_mcp_list_plans(public.agym_plan_status, integer) from public, anon;
revoke execute on function public.remote_mcp_create_proposed_plan(text, jsonb) from public, anon;
grant execute on function public.remote_mcp_get_context(date, date, integer, boolean) to authenticated;
grant execute on function public.remote_mcp_list_plans(public.agym_plan_status, integer) to authenticated;
grant execute on function public.remote_mcp_create_proposed_plan(text, jsonb) to authenticated;
