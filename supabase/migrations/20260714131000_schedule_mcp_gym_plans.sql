-- Schedule agent-created Gym plans from their validated plan_data. Legacy plans
-- remain supported and default to the creation date when no Gym schedule exists.
create or replace function public.create_mcp_proposed_plan(
  p_user_id uuid,
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
  created_plan public.plans;
  scheduled_date date := current_date;
begin
  if length(trim(p_raw_plan_text)) = 0 then raise exception 'plan text must not be blank'; end if;
  if not exists (select 1 from public.agent_authorizations where id = p_authorization_id and user_id = p_user_id and agent_identifier = p_agent_identifier and action = 'write_proposed_plan' and revoked_at is null) then
    raise exception 'no active write_proposed_plan authorization exists';
  end if;
  if coalesce(p_plan_data->>'kind', '') = 'gym_workout' then
    begin scheduled_date := (p_plan_data->>'scheduled_for')::date;
    exception when others then raise exception 'gym_workout plan_data requires scheduled_for as YYYY-MM-DD'; end;
  end if;
  insert into public.plans (user_id, raw_plan_text, plan_data, source_client, scheduled_for)
  values (p_user_id, p_raw_plan_text, coalesce(p_plan_data, '{}'::jsonb), p_agent_identifier, scheduled_date)
  returning * into created_plan;
  insert into public.agent_audit_log (user_id, authorization_id, agent_identifier, action, resource_type, resource_id, metadata)
  values (p_user_id, p_authorization_id, p_agent_identifier, 'create_proposed_plan', 'plan', created_plan.id,
    jsonb_build_object('plan_status', created_plan.status, 'source_client', p_agent_identifier, 'plan_data_present', p_plan_data <> '{}'::jsonb, 'raw_plan_text_length', length(p_raw_plan_text), 'scheduled_for', scheduled_date));
  return created_plan;
end;
$$;
