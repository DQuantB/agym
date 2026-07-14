-- AGym private invite-only Networked Agent Alpha foundation.
-- This migration intentionally creates the smallest hosted trust boundary before
-- browser persistence, LLM parsing, or MCP wiring. Every public user-data table
-- is scoped by user_id and protected with row-level security.

create type public.agym_provenance as enum (
  'raw_self_report',
  'llm_parsed_uncertain',
  'user_confirmed',
  'agent_written_plan'
);

create type public.agym_parse_status as enum ('parsed', 'partial', 'failed');
create type public.agym_plan_status as enum ('proposed', 'active', 'superseded', 'archived');
create type public.agym_authorization_action as enum ('read_context', 'write_proposed_plan');
create type public.agym_consent_type as enum ('llm_parsing');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  unit_preference text not null default 'kg' check (unit_preference in ('kg', 'lb')),
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.raw_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  raw_text text not null check (length(trim(raw_text)) > 0),
  logged_for_date date not null default current_date,
  source_hint text check (source_hint in ('workout', 'meal', 'sleep', 'mood', 'other') or source_hint is null),
  plan_id uuid,
  client_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, id)
);

create table public.parse_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  raw_log_id uuid not null,
  event_type text not null,
  fields jsonb not null default '{}'::jsonb,
  confidence jsonb not null default '{}'::jsonb,
  safety_flags jsonb not null default '[]'::jsonb,
  parse_status public.agym_parse_status not null,
  provenance public.agym_provenance not null default 'llm_parsed_uncertain'
    check (provenance = 'llm_parsed_uncertain'),
  parser_version text,
  created_at timestamptz not null default now(),
  foreign key (user_id, raw_log_id) references public.raw_logs(user_id, id) on delete cascade,
  unique (user_id, id)
);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  raw_plan_text text not null check (length(trim(raw_plan_text)) > 0),
  plan_data jsonb not null default '{}'::jsonb,
  provenance public.agym_provenance not null default 'agent_written_plan'
    check (provenance = 'agent_written_plan'),
  status public.agym_plan_status not null default 'proposed',
  source_client text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, id)
);

alter table public.raw_logs
  add constraint raw_logs_plan_owner_fk
  foreign key (user_id, plan_id) references public.plans(user_id, id) on delete set null (plan_id);

create table public.canonical_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_raw_log_id uuid not null,
  source_parse_draft_id uuid,
  plan_id uuid,
  event_type text not null,
  final_fields jsonb not null default '{}'::jsonb,
  correction_diff jsonb,
  provenance public.agym_provenance not null default 'user_confirmed'
    check (provenance = 'user_confirmed'),
  confirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (user_id, source_raw_log_id) references public.raw_logs(user_id, id),
  foreign key (user_id, source_parse_draft_id) references public.parse_drafts(user_id, id),
  foreign key (user_id, plan_id) references public.plans(user_id, id)
);

create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  consent_type public.agym_consent_type not null,
  granted boolean not null,
  consent_version text not null,
  granted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (granted and granted_at is not null and revoked_at is null)
    or (not granted and revoked_at is not null)
  )
);

create table public.agent_authorizations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  agent_identifier text not null,
  action public.agym_authorization_action not null,
  scope jsonb not null default '{}'::jsonb,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, id)
);

create table public.agent_audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  authorization_id uuid,
  agent_identifier text not null,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  foreign key (user_id, authorization_id) references public.agent_authorizations(user_id, id)
);

create index raw_logs_user_created_at_idx on public.raw_logs (user_id, created_at desc);
create index parse_drafts_user_created_at_idx on public.parse_drafts (user_id, created_at desc);
create index canonical_events_user_confirmed_at_idx on public.canonical_events (user_id, confirmed_at desc);
create index plans_user_created_at_idx on public.plans (user_id, created_at desc);
create index authorizations_active_idx on public.agent_authorizations (user_id, agent_identifier, action) where revoked_at is null;
create index agent_audit_log_user_occurred_at_idx on public.agent_audit_log (user_id, occurred_at desc);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'display_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute procedure public.set_updated_at();
create trigger plans_set_updated_at before update on public.plans
  for each row execute procedure public.set_updated_at();
create trigger canonical_events_set_updated_at before update on public.canonical_events
  for each row execute procedure public.set_updated_at();

-- Authorization grants are historical evidence. A user may only revoke a grant;
-- they cannot rewrite the agent, action, scope, or original grant timestamp.
create or replace function public.only_allow_authorization_revocation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.user_id is distinct from new.user_id
    or old.agent_identifier is distinct from new.agent_identifier
    or old.action is distinct from new.action
    or old.scope is distinct from new.scope
    or old.granted_at is distinct from new.granted_at
    or old.created_at is distinct from new.created_at
    or old.revoked_at is not null
    or new.revoked_at is null then
    raise exception 'agent authorizations may only be revoked once';
  end if;
  return new;
end;
$$;

create trigger agent_authorizations_revoke_only before update on public.agent_authorizations
  for each row execute procedure public.only_allow_authorization_revocation();

-- Consent history is append-only. Revocation is represented as a new record with
-- granted = false, preserving exactly what was agreed and when.
create or replace function public.prevent_consent_record_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'consent records are append-only';
end;
$$;

create trigger consent_records_immutable before update on public.consent_records
  for each row execute procedure public.prevent_consent_record_update();

-- Sensitive lifecycle timestamps are generated by the database rather than
-- accepted from a browser payload.
create or replace function public.set_trusted_event_timestamps()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'consent_records' then
    new.created_at = now();
    if new.granted then
      new.granted_at = now();
      new.revoked_at = null;
    else
      new.granted_at = null;
      new.revoked_at = now();
    end if;
  elsif tg_table_name = 'agent_authorizations' then
    new.created_at = now();
    new.granted_at = now();
    new.revoked_at = null;
  elsif tg_table_name = 'canonical_events' then
    new.created_at = now();
    new.confirmed_at = now();
  elsif tg_table_name = 'agent_audit_log' then
    new.occurred_at = now();
  elsif tg_table_name = 'raw_logs' then
    new.created_at = now();
  end if;
  return new;
end;
$$;

create trigger raw_logs_trusted_timestamps before insert on public.raw_logs
  for each row execute procedure public.set_trusted_event_timestamps();
create trigger canonical_events_trusted_timestamps before insert on public.canonical_events
  for each row execute procedure public.set_trusted_event_timestamps();
create trigger consent_records_trusted_timestamps before insert on public.consent_records
  for each row execute procedure public.set_trusted_event_timestamps();
create trigger agent_authorizations_trusted_timestamps before insert on public.agent_authorizations
  for each row execute procedure public.set_trusted_event_timestamps();
create trigger agent_audit_log_trusted_timestamps before insert on public.agent_audit_log
  for each row execute procedure public.set_trusted_event_timestamps();

alter table public.profiles enable row level security;
alter table public.raw_logs enable row level security;
alter table public.parse_drafts enable row level security;
alter table public.canonical_events enable row level security;
alter table public.plans enable row level security;
alter table public.consent_records enable row level security;
alter table public.agent_authorizations enable row level security;
alter table public.agent_audit_log enable row level security;

-- The browser may only operate on its own profile and user-confirmed raw/outcome data.
create policy "profiles are visible to their owner" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profiles are editable by their owner" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "users read their raw logs" on public.raw_logs for select to authenticated using ((select auth.uid()) = user_id);
create policy "users create their raw logs" on public.raw_logs for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "users read their parse drafts" on public.parse_drafts for select to authenticated using ((select auth.uid()) = user_id);

create policy "users read their canonical events" on public.canonical_events for select to authenticated using ((select auth.uid()) = user_id);
create policy "users confirm their canonical events" on public.canonical_events for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "users delete their canonical events" on public.canonical_events for delete to authenticated using ((select auth.uid()) = user_id);

create policy "users read their plans" on public.plans for select to authenticated using ((select auth.uid()) = user_id);

create policy "users read their consent records" on public.consent_records for select to authenticated using ((select auth.uid()) = user_id);
create policy "users create their consent records" on public.consent_records for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "users read their agent authorizations" on public.agent_authorizations for select to authenticated using ((select auth.uid()) = user_id);
create policy "users create their agent authorizations" on public.agent_authorizations for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "users revoke their agent authorizations" on public.agent_authorizations for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "users read their agent audit history" on public.agent_audit_log for select to authenticated using ((select auth.uid()) = user_id);

revoke all on public.profiles, public.raw_logs, public.parse_drafts, public.canonical_events, public.plans, public.consent_records, public.agent_authorizations, public.agent_audit_log from anon;
grant select, update on public.profiles to authenticated;
grant select, insert on public.raw_logs to authenticated;
grant select on public.parse_drafts to authenticated;
grant select, insert, delete on public.canonical_events to authenticated;
grant select on public.plans to authenticated;
grant select, insert on public.consent_records to authenticated;
grant select, insert, update on public.agent_authorizations to authenticated;
grant select on public.agent_audit_log to authenticated;
