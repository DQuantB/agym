-- Phase 4: authenticated users may explicitly request a deterministic parse of
-- an already-saved raw log. Raw evidence stays immutable; the parser produces a
-- separately stored, explicitly uncertain draft.
create or replace function public.create_deterministic_parse_draft(p_raw_log_id uuid)
returns setof public.parse_drafts
language plpgsql
security definer
set search_path = ''
as $$
declare
  authenticated_user_id uuid := auth.uid();
  source_log public.raw_logs;
  parsed_fields jsonb;
  parsed_confidence jsonb := '{}'::jsonb;
  parsed_safety_flags jsonb := '[]'::jsonb;
  parsed_status public.agym_parse_status := 'partial';
  captures text[];
  set_count integer;
  rep_count integer;
  load_kg numeric;
  created_draft public.parse_drafts;
begin
  if authenticated_user_id is null then
    raise exception 'authenticated user required';
  end if;

  select * into source_log
  from public.raw_logs
  where id = p_raw_log_id and user_id = authenticated_user_id and deleted_at is null;
  if source_log.id is null then
    raise exception 'raw log not found for authenticated user';
  end if;

  captures := regexp_match(
    source_log.raw_text,
    '^\s*([[:alpha:]][[:alpha:] -]*)\s+([0-9]+)\s*x\s*([0-9]+)\s*@?\s*([0-9]+(?:\.[0-9]+)?)?\s*(kg|kgs|lb|lbs)?',
    'i'
  );

  if captures is not null then
    set_count := captures[2]::integer;
    rep_count := captures[3]::integer;
    load_kg := nullif(captures[4], '')::numeric;
    if lower(coalesce(captures[5], '')) like 'lb%' and load_kg is not null then
      load_kg := round(load_kg * 0.453592, 1);
      parsed_safety_flags := jsonb_build_array(jsonb_build_object('field', 'exercises.0.sets.weightKg', 'reason', 'weight converted from lbs to kg'));
    elsif load_kg is null then
      parsed_safety_flags := jsonb_build_array(jsonb_build_object('field', 'exercises.0.sets.weightKg', 'reason', 'load was not stated'));
    end if;
    parsed_fields := jsonb_build_object(
      'kind', 'workout',
      'exercises', jsonb_build_array(jsonb_build_object(
        'name', trim(captures[1]),
        'sets', (select jsonb_agg(jsonb_build_object('reps', rep_count, 'weightKg', load_kg, 'rpe', null)) from generate_series(1, greatest(set_count, 1)))
      )),
      'durationMin', null,
      'notes', null
    );
    parsed_status := case when load_kg is null then 'partial' else 'parsed' end;
  else
    parsed_fields := jsonb_build_object('kind', 'note', 'text', source_log.raw_text);
    parsed_safety_flags := jsonb_build_array(jsonb_build_object('field', 'kind', 'reason', 'deterministic parser could not safely structure this text'));
  end if;

  insert into public.parse_drafts (user_id, raw_log_id, event_type, fields, confidence, safety_flags, parse_status, parser_version)
  values (authenticated_user_id, source_log.id, parsed_fields ->> 'kind', parsed_fields, parsed_confidence, parsed_safety_flags, parsed_status, 'deterministic-v1')
  returning * into created_draft;
  return next created_draft;
end;
$$;

revoke all on function public.create_deterministic_parse_draft(uuid) from public, anon;
grant execute on function public.create_deterministic_parse_draft(uuid) to authenticated;
