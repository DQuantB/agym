-- Remote OAuth MCP plans must carry the same durable scheduled date as local
-- MCP Gym plans. The mobile Today query uses plans.scheduled_for, while the
-- structured payload remains the immutable agent-authored proposal.
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

  insert into public.agent_audit_log (user_id, authorization_id, agent_identifier, action, resource_type, resource_id, metadata)
  values (authenticated_user_id, active_authorization_id, 'remote-mcp', 'create_proposed_plan', 'plan', created_plan.id,
    jsonb_build_object('plan_status', created_plan.status, 'source_client', 'remote-mcp',
      'plan_data_present', p_plan_data <> '{}'::jsonb, 'raw_plan_text_length', length(p_raw_plan_text),
      'scheduled_for', scheduled_date));
  return to_jsonb(created_plan);
end;
$$;
