-- Remote-MCP search over the metadata-only exercise catalogue (see
-- 20260723180000_add_exercise_catalogue.sql). The catalogue table itself is
-- not behind the OAuth-MCP-client restrictive policies (it is non-user
-- reference data), but every other remote MCP tool reaches AGym data only
-- through a security-definer RPC, never a direct table query -- this RPC
-- keeps that one consistent invariant rather than special-casing an
-- exception for this table.
--
-- Gated on the existing read_context grant: catalogue search is offered
-- alongside get_context/list_plans as part of the same "give the agent
-- bounded read access" surface, not a new grant type.
create or replace function public.remote_mcp_search_exercise_catalogue(
  p_query text default null,
  p_body_part text default null,
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
  search_words text[];
  result jsonb;
begin
  if p_limit < 1 or p_limit > 50 then raise exception 'limit must be between 1 and 50'; end if;
  active_authorization_id := public.remote_mcp_authorization('read_context');
  if active_authorization_id is null then
    return jsonb_build_object('error', 'No active read_context authorization exists for remote-mcp.');
  end if;

  select coalesce(array_agg(word), '{}') into search_words
  from regexp_split_to_table(coalesce(trim(p_query), ''), '\s+') as word
  where word <> '';

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', exercise.id, 'name', exercise.name, 'category', exercise.category,
    'body_part', exercise.body_part, 'equipment', exercise.equipment,
    'muscle_group', exercise.muscle_group, 'secondary_muscles', exercise.secondary_muscles,
    'target', exercise.target
  ) order by exercise.name, exercise.id), '[]'::jsonb) into result
  from (
    select id, name, category, body_part, equipment, muscle_group, secondary_muscles, target
    from public.exercise_catalogue
    where (p_body_part is null or body_part = p_body_part)
      and (
        array_length(search_words, 1) is null
        or not exists (
          select 1 from unnest(search_words) as word
          where not (
            name ilike '%' || word || '%' or target ilike '%' || word || '%'
            or muscle_group ilike '%' || word || '%' or equipment ilike '%' || word || '%'
            or category ilike '%' || word || '%' or body_part ilike '%' || word || '%'
          )
        )
      )
    order by name, id
    limit p_limit
  ) exercise;

  insert into public.agent_audit_log (user_id, authorization_id, agent_identifier, action, resource_type, metadata)
  values (authenticated_user_id, active_authorization_id, 'remote-mcp', 'search_exercise_catalogue', 'exercise_catalogue',
    jsonb_build_object('query', p_query, 'body_part', p_body_part, 'limit', p_limit, 'result_count', jsonb_array_length(result)));
  return result;
end;
$$;

revoke execute on function public.remote_mcp_search_exercise_catalogue(text, text, integer) from public, anon;
grant execute on function public.remote_mcp_search_exercise_catalogue(text, text, integer) to authenticated;
