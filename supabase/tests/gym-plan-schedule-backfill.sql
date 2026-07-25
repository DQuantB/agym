\set ON_ERROR_STOP on

begin;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-4000-8000-0000000000b1',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'legacy-schedule@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.plans (user_id, raw_plan_text, plan_data, source_client, scheduled_for)
values
  ('00000000-0000-4000-8000-0000000000b1', 'Legacy valid Gym plan', '{"kind":"gym_workout","scheduled_for":"2026-07-25"}'::jsonb, 'remote-mcp', null),
  ('00000000-0000-4000-8000-0000000000b1', 'Legacy malformed Gym plan', '{"kind":"gym_workout","scheduled_for":"not-a-date"}'::jsonb, 'remote-mcp', null),
  ('00000000-0000-4000-8000-0000000000b1', 'Non-Gym plan', '{"kind":"running","scheduled_for":"2026-07-25"}'::jsonb, 'remote-mcp', null),
  ('00000000-0000-4000-8000-0000000000b1', 'Already scheduled Gym plan', '{"kind":"gym_workout","scheduled_for":"2026-07-25"}'::jsonb, 'remote-mcp', '2026-07-26');

-- Re-run the idempotent migration after adding pre-release-shaped rows, so this
-- test executes the production backfill itself rather than duplicating its logic.
\ir ../migrations/20260725170000_backfill_gym_plan_schedule_dates.sql

do $$
begin
  if (select scheduled_for from public.plans where raw_plan_text = 'Legacy valid Gym plan') <> date '2026-07-25' then
    raise exception 'legacy valid Gym plan did not retain a durable schedule date';
  end if;
  if (select scheduled_for from public.plans where raw_plan_text = 'Legacy malformed Gym plan') is not null then
    raise exception 'malformed legacy Gym schedule should remain untouched';
  end if;
  if (select scheduled_for from public.plans where raw_plan_text = 'Non-Gym plan') is not null then
    raise exception 'non-Gym plan should remain untouched';
  end if;
  if (select scheduled_for from public.plans where raw_plan_text = 'Already scheduled Gym plan') <> date '2026-07-26' then
    raise exception 'existing durable schedule should not be overwritten';
  end if;
end;
$$;

rollback;
