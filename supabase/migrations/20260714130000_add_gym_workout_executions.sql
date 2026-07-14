-- Gym execution surface: agent plans remain immutable proposals; a user-owned
-- execution captures the editable reality and completes into a linked canonical
-- outcome. This is Gym-specific intentionally; running/meals will have their
-- own item schemas later.

alter table public.plans add column scheduled_for date;
create index plans_user_scheduled_for_idx on public.plans (user_id, scheduled_for desc)
  where deleted_at is null;

create type public.workout_execution_status as enum ('in_progress', 'completed');

create table public.workout_executions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid not null,
  scheduled_for date not null,
  status public.workout_execution_status not null default 'in_progress',
  planned_snapshot jsonb not null,
  execution_data jsonb not null default '{}'::jsonb,
  additional_notes text not null default '',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, plan_id) references public.plans(user_id, id),
  check (jsonb_typeof(planned_snapshot) = 'object'),
  check (jsonb_typeof(execution_data) = 'object'),
  check ((status = 'in_progress' and completed_at is null) or (status = 'completed' and completed_at is not null))
);

-- One unfinished execution for a scheduled plan. A completed execution remains
-- as the durable user-confirmed history instead of being overwritten.
create unique index workout_executions_one_active_per_plan_idx
  on public.workout_executions (user_id, plan_id)
  where status = 'in_progress';
create index workout_executions_user_scheduled_for_idx
  on public.workout_executions (user_id, scheduled_for desc);

create trigger workout_executions_set_updated_at before update on public.workout_executions
  for each row execute procedure public.set_updated_at();

-- Browser edits are deliberately narrow. It may update actual values and raw
-- notes while in progress, but cannot swap its owner/plan/baseline/date. RLS
-- below blocks a browser from ever writing a completed status; the owner-run
-- completion RPC bypasses RLS and creates the required evidence atomically.
create or replace function public.guard_workout_execution_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'completed' then
    raise exception 'completed workouts are immutable';
  end if;
  if new.user_id <> old.user_id
     or new.plan_id <> old.plan_id
     or new.scheduled_for <> old.scheduled_for
     or new.planned_snapshot <> old.planned_snapshot then
    raise exception 'workout plan baseline is immutable';
  end if;
  return new;
end;
$$;
create trigger workout_executions_guard_update before update on public.workout_executions
  for each row execute procedure public.guard_workout_execution_update();

alter table public.workout_executions enable row level security;
-- RLS filters rows; explicit table privileges let authenticated browser sessions
-- perform only the lifecycle operations permitted by the policies below.
grant select, insert, update on public.workout_executions to authenticated;
create policy "users read their workout executions" on public.workout_executions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "users start their workout executions" on public.workout_executions
  for insert to authenticated with check (
    (select auth.uid()) = user_id and status = 'in_progress' and completed_at is null
  );
create policy "users update their in-progress workout executions" on public.workout_executions
  for update to authenticated using ((select auth.uid()) = user_id and status = 'in_progress')
  with check ((select auth.uid()) = user_id and status = 'in_progress' and completed_at is null);

create or replace function public.complete_gym_workout_execution(p_execution_id uuid)
returns public.canonical_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  execution public.workout_executions;
  source_log public.raw_logs;
  completed_event public.canonical_events;
begin
  if caller is null then
    raise exception 'workout completion requires an authenticated user';
  end if;

  select * into execution
  from public.workout_executions
  where id = p_execution_id and user_id = caller
  for update;

  if not found then
    raise exception 'workout execution was not found for this account';
  end if;
  if execution.status <> 'in_progress' then
    raise exception 'workout execution has already been completed';
  end if;

  insert into public.raw_logs (
    user_id, client_id, raw_text, logged_for_date, source_hint, plan_id, client_meta
  ) values (
    caller,
    'workout-execution-' || execution.id::text,
    concat('Structured workout execution. Additional notes: ', execution.additional_notes),
    execution.scheduled_for,
    'workout',
    execution.plan_id,
    jsonb_build_object('source', 'workout_execution', 'execution_id', execution.id)
  ) returning * into source_log;

  insert into public.canonical_events (
    user_id, client_id, source_raw_log_id, plan_id, event_type, final_fields
  ) values (
    caller,
    'workout-event-' || execution.id::text,
    source_log.id,
    execution.plan_id,
    'workout_execution',
    jsonb_build_object(
      'kind', 'workout_execution',
      'schema_version', 1,
      'scheduled_for', execution.scheduled_for,
      'planned_snapshot', execution.planned_snapshot,
      'actual', execution.execution_data,
      'additional_notes', execution.additional_notes,
      'execution_id', execution.id
    )
  ) returning * into completed_event;

  update public.workout_executions
  set status = 'completed', completed_at = now()
  where id = execution.id and user_id = caller;

  return completed_event;
end;
$$;

revoke execute on function public.complete_gym_workout_execution(uuid) from public;
revoke execute on function public.complete_gym_workout_execution(uuid) from anon;
revoke execute on function public.complete_gym_workout_execution(uuid) from service_role;
grant execute on function public.complete_gym_workout_execution(uuid) to authenticated;
