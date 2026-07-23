-- Run with psql ON_ERROR_STOP=1 or through `supabase db reset --sql-paths`.
begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'parser-owner@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'parser-other@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', true);
insert into public.raw_logs (user_id, client_id, raw_text, logged_for_date, source_hint)
values ('00000000-0000-0000-0000-0000000000d1', 'raw-parser-owner', 'Squat 3x8@80kg', '2026-07-22', 'workout');

select case when (select fields ->> 'kind' from public.create_deterministic_parse_draft((select id from public.raw_logs where user_id = '00000000-0000-0000-0000-0000000000d1'))) = 'workout'
  then 'PASS: owner receives an uncertain deterministic workout draft'
  else 'FAIL: deterministic workout draft missing' end;

select case when exists (
  select 1 from public.parse_drafts
  where user_id = '00000000-0000-0000-0000-0000000000d1'
    and provenance = 'llm_parsed_uncertain'
    and parser_version = 'deterministic-v1'
    and fields #>> '{exercises,0,sets,0,reps}' = '8'
) then 'PASS: draft preserves structured parse with uncertain provenance'
else 'FAIL: structured uncertain draft missing' end;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d2', true);
do $$ begin
  begin
    perform public.create_deterministic_parse_draft((select id from public.raw_logs where user_id = '00000000-0000-0000-0000-0000000000d1'));
    raise exception 'FAIL: cross-user parse unexpectedly succeeded';
  exception when others then
    if SQLERRM <> 'raw log not found for authenticated user' then raise; end if;
    raise notice 'PASS: cross-user parsing rejected';
  end;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', true);
insert into public.canonical_events (user_id, client_id, source_raw_log_id, source_parse_draft_id, event_type, final_fields, provenance)
values (
  '00000000-0000-0000-0000-0000000000d1',
  'canonical-parser-owner',
  (select id from public.raw_logs where user_id = '00000000-0000-0000-0000-0000000000d1'),
  (select id from public.parse_drafts where user_id = '00000000-0000-0000-0000-0000000000d1'),
  'workout', '{"kind":"workout"}'::jsonb, 'user_confirmed'
);

select case when exists (select 1 from public.canonical_events where user_id = '00000000-0000-0000-0000-0000000000d1' and provenance = 'user_confirmed')
  then 'PASS: owner confirms a canonical event linked to raw evidence and draft'
  else 'FAIL: owner confirmation missing' end;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d2', true);
do $$ begin
  begin
    insert into public.canonical_events (user_id, client_id, source_raw_log_id, source_parse_draft_id, event_type, final_fields, provenance)
    values ('00000000-0000-0000-0000-0000000000d2', 'canonical-parser-other', (select id from public.raw_logs where user_id = '00000000-0000-0000-0000-0000000000d1'), (select id from public.parse_drafts where user_id = '00000000-0000-0000-0000-0000000000d1'), 'workout', '{"kind":"workout"}'::jsonb, 'user_confirmed');
    raise exception 'FAIL: cross-user canonical confirmation unexpectedly succeeded';
  exception when others then
    if position('FAIL: cross-user canonical confirmation unexpectedly succeeded' in SQLERRM) > 0 then raise; end if;
    raise notice 'PASS: cross-user canonical confirmation rejected';
  end;
end $$;

rollback;
