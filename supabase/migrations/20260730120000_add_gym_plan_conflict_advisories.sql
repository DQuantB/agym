-- Advisory same-date conflict detection for agent-proposed Gym plans. Never
-- blocking: same-date PROPOSED plans are the normal "ask for changes" revision
-- loop (there is no reject/decline RPC and nothing ever writes
-- superseded/archived), so a unique constraint or a hard rejection here would
-- strand a user mid-revision. Instead every create_proposed_plan response now
-- carries a `conflicts` object the agent can act on, per the existing product
-- rule to "surface the conflict rather than silently picking one."

-- One helper shared by both the local (service_role) and remote (OAuth)
-- creation RPCs, so the two paths cannot silently diverge the way
-- scheduled_for defaults and list_plans columns already have. Both callers
-- are SECURITY DEFINER functions owned by the migration role, so this
-- helper resolves EXECUTE via ownership and its reads bypass RLS -- the same
-- mechanism remote_mcp_list_plans already relies on. It is intentionally not
-- directly callable: it takes p_user_id as a caller-supplied argument and
-- bypasses RLS, so granting it to `authenticated` would let any browser
-- session pass an arbitrary user id and read that account's plan ids/titles.
create or replace function public.gym_plan_conflicts(
  p_user_id uuid,
  p_scheduled_for date,
  p_exclude_plan_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  competing jsonb := '[]'::jsonb;
  active_count integer := 0;
  proposed_count integer := 0;
  revised_count integer := 0;
  executed_count integer := 0;
  severity text := 'none';
  reasons_arr text[] := '{}';
  advisory text;
begin
  -- Non-gym and unscheduled plans have no meaningful date semantics (the
  -- local RPC defaults them to current_date, the remote one leaves them
  -- null): skip the check rather than manufacture a phantom conflict.
  if p_scheduled_for is null then
    return jsonb_build_object(
      'checked', false,
      'scheduled_for', null,
      'severity', 'none',
      'counts', jsonb_build_object('active', 0, 'proposed', 0),
      'reasons', '[]'::jsonb,
      'plans', '[]'::jsonb,
      'advisory', 'This plan carries no Gym schedule date, so no same-date check was performed.'
    );
  end if;

  select
    coalesce(jsonb_agg(jsonb_build_object(
      'id', candidate.id,
      'status', candidate.status,
      'title', candidate.title,
      'source_client', candidate.source_client,
      'created_at', candidate.created_at,
      'has_user_revision', candidate.has_user_revision,
      'has_execution', candidate.has_execution
    ) order by (candidate.status = 'active') desc, candidate.created_at desc), '[]'::jsonb),
    count(*) filter (where candidate.status = 'active'),
    count(*) filter (where candidate.status = 'proposed'),
    count(*) filter (where candidate.status = 'active' and candidate.has_user_revision),
    count(*) filter (where candidate.status = 'active' and candidate.has_execution)
  into competing, active_count, proposed_count, revised_count, executed_count
  from (
    select
      plan.id,
      plan.status,
      plan.source_client,
      plan.created_at,
      coalesce(plan.user_revision_data ->> 'title', plan.plan_data ->> 'title', 'Untitled plan') as title,
      plan.user_revision_data is not null as has_user_revision,
      exists (
        select 1 from public.workout_executions execution
        where execution.plan_id = plan.id and execution.user_id = plan.user_id
      ) as has_execution
    from public.plans plan
    where plan.user_id = p_user_id
      and plan.scheduled_for = p_scheduled_for
      and plan.deleted_at is null
      and plan.status in ('proposed', 'active')
      and coalesce(plan.plan_data ->> 'kind', '') = 'gym_workout'
      and (p_exclude_plan_id is null or plan.id <> p_exclude_plan_id)
  ) candidate;

  if active_count > 0 then
    severity := 'warning';
  elsif proposed_count > 0 then
    severity := 'notice';
  end if;

  -- Amplifiers first: an accepted plan the user hand-revised, or already
  -- started training against, is a materially worse thing to shadow than a
  -- pristine agent plan.
  if active_count > 0 then reasons_arr := array_append(reasons_arr, 'active_plan_accepted'); end if;
  if revised_count > 0 then reasons_arr := array_append(reasons_arr, 'active_plan_user_revised'); end if;
  if executed_count > 0 then reasons_arr := array_append(reasons_arr, 'active_plan_has_execution'); end if;
  if proposed_count > 0 then reasons_arr := array_append(reasons_arr, 'duplicate_proposal'); end if;

  advisory := case severity
    when 'warning' then format(
      'The user has already accepted a Gym session for %s. This proposal was still created and nothing was superseded or changed. Surface the existing session and let the user choose.',
      p_scheduled_for)
    when 'notice' then format(
      '%s other Gym proposal(s) already await the user''s review for %s. Nothing was superseded. Say plainly which proposal replaces which.',
      proposed_count, p_scheduled_for)
    else format('No other Gym plan exists for %s.', p_scheduled_for)
  end;

  return jsonb_build_object(
    'checked', true,
    'scheduled_for', p_scheduled_for,
    'severity', severity,
    'counts', jsonb_build_object('active', active_count, 'proposed', proposed_count),
    'reasons', to_jsonb(reasons_arr),
    'plans', competing,
    'advisory', advisory
  );
end;
$$;

revoke all on function public.gym_plan_conflicts(uuid, date, uuid)
  from public, anon, authenticated, service_role;

-- The local RPC returned `public.plans` (a bare table row, no room for a
-- warning field). Changing the return type requires DROP + CREATE. Dropping
-- is safe: mcp/agym-server.ts is the only production caller (untyped
-- client.rpc), the function is granted only to service_role so there is no
-- other consumer, and supabase/tests/rls-isolation.sql calls it via `perform`
-- which is return-type agnostic. DROP destroys all grants and the recreated
-- function immediately inherits Supabase's default EXECUTE grants to
-- anon/authenticated/service_role -- since this function takes p_user_id and
-- is SECURITY DEFINER, leaving `authenticated` with EXECUTE would let any
-- browser session write an agent-provenance plan into another account. Both
-- revoke lines below are required; rls-isolation.sql's existing
-- insufficient_privilege assertion is the regression guard for this.
drop function if exists public.create_mcp_proposed_plan(uuid, uuid, text, text, jsonb);

create function public.create_mcp_proposed_plan(
  p_user_id uuid,
  p_authorization_id uuid,
  p_agent_identifier text,
  p_raw_plan_text text,
  p_plan_data jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_plan public.plans;
  scheduled_date date := current_date;
  conflict_date date := null;
  conflicts jsonb;
begin
  if length(trim(p_raw_plan_text)) = 0 then raise exception 'plan text must not be blank'; end if;
  if not exists (select 1 from public.agent_authorizations where id = p_authorization_id and user_id = p_user_id and agent_identifier = p_agent_identifier and action = 'write_proposed_plan' and revoked_at is null) then
    raise exception 'no active write_proposed_plan authorization exists';
  end if;
  if coalesce(p_plan_data->>'kind', '') = 'gym_workout' then
    begin scheduled_date := (p_plan_data->>'scheduled_for')::date;
    exception when others then raise exception 'gym_workout plan_data requires scheduled_for as YYYY-MM-DD'; end;
    conflict_date := scheduled_date;
  end if;
  insert into public.plans (user_id, raw_plan_text, plan_data, source_client, scheduled_for)
  values (p_user_id, p_raw_plan_text, coalesce(p_plan_data, '{}'::jsonb), p_agent_identifier, scheduled_date)
  returning * into created_plan;

  conflicts := public.gym_plan_conflicts(p_user_id, conflict_date, created_plan.id);

  insert into public.agent_audit_log (user_id, authorization_id, agent_identifier, action, resource_type, resource_id, metadata)
  values (p_user_id, p_authorization_id, p_agent_identifier, 'create_proposed_plan', 'plan', created_plan.id,
    jsonb_build_object('plan_status', created_plan.status, 'source_client', p_agent_identifier, 'plan_data_present', p_plan_data <> '{}'::jsonb, 'raw_plan_text_length', length(p_raw_plan_text), 'scheduled_for', scheduled_date, 'conflict_severity', conflicts ->> 'severity'));

  return jsonb_build_object('plan', to_jsonb(created_plan), 'conflicts', conflicts);
end;
$$;

revoke all on function public.create_mcp_proposed_plan(uuid, uuid, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_mcp_proposed_plan(uuid, uuid, text, text, jsonb) to service_role;

-- Remote RPC already returns jsonb, so this is a plain create-or-replace and
-- its existing grants survive unchanged.
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
  scheduled_date date := null;
  conflicts jsonb;
begin
  if length(trim(p_raw_plan_text)) = 0 then raise exception 'plan text must not be blank'; end if;
  active_authorization_id := public.remote_mcp_authorization('write_proposed_plan');
  if active_authorization_id is null then
    return jsonb_build_object('error', 'No active write_proposed_plan authorization exists for remote-mcp.');
  end if;

  if coalesce(p_plan_data->>'kind', '') = 'gym_workout' then
    begin
      scheduled_date := (p_plan_data->>'scheduled_for')::date;
    exception when others then
      raise exception 'gym_workout plan_data requires scheduled_for as YYYY-MM-DD';
    end;
  end if;

  insert into public.plans (user_id, raw_plan_text, plan_data, source_client, scheduled_for)
  values (authenticated_user_id, p_raw_plan_text, coalesce(p_plan_data, '{}'::jsonb), 'remote-mcp', scheduled_date)
  returning * into created_plan;

  conflicts := public.gym_plan_conflicts(authenticated_user_id, scheduled_date, created_plan.id);

  insert into public.agent_audit_log (user_id, authorization_id, agent_identifier, action, resource_type, resource_id, metadata)
  values (authenticated_user_id, active_authorization_id, 'remote-mcp', 'create_proposed_plan', 'plan', created_plan.id,
    jsonb_build_object('plan_status', created_plan.status, 'source_client', 'remote-mcp',
      'plan_data_present', p_plan_data <> '{}'::jsonb, 'raw_plan_text_length', length(p_raw_plan_text),
      'scheduled_for', scheduled_date, 'conflict_severity', conflicts ->> 'severity'));
  return jsonb_build_object('plan', to_jsonb(created_plan), 'conflicts', conflicts);
end;
$$;

-- A remote agent could not previously see scheduled_for at all (unlike the
-- local list_plans, which already selects it), so it had no way to avoid
-- conflicts even by checking first. Add the one missing column.
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
    select id, raw_plan_text, plan_data, provenance, status, source_client, scheduled_for, created_at, updated_at
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
