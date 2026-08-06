-- Coach discovery landing page ("/coaches") email capture. This is the first
-- anon-writable surface in the schema: a prospective coach who has not
-- created an AGym account submits their email for early-access notification.
-- It intentionally does not touch profiles/auth.users, carries no client
-- health data, and grants anon insert-only -- no select/update/delete -- so a
-- submitted address cannot be read back, enumerated, or amended from the
-- browser. The founder reads/exports/deletes rows via the Supabase dashboard
-- (service_role) until a self-serve flow is worth building for a small list.

create table public.coach_leads (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 320),
  coach_name text check (coach_name is null or length(trim(coach_name)) between 1 and 120),
  note text check (note is null or length(note) <= 2000),
  source text not null default 'coaches_landing_page' check (length(source) <= 120),
  consent_marketing boolean not null default true,
  created_at timestamptz not null default now()
);

create index coach_leads_created_at_idx on public.coach_leads (created_at desc);

-- Timestamp is server-generated, matching the rest of the schema's
-- trusted-timestamp convention -- a browser payload cannot backdate a lead.
create or replace function public.set_coach_lead_timestamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_at = now();
  return new;
end;
$$;

create trigger coach_leads_trusted_timestamp before insert on public.coach_leads
  for each row execute procedure public.set_coach_lead_timestamp();

alter table public.coach_leads enable row level security;

create policy "anyone can submit a coach lead" on public.coach_leads
  for insert to anon, authenticated with check (true);

-- service_role bypasses RLS but, like every other table in this schema
-- (see 20260723180000_add_exercise_catalogue.sql), still needs an explicit
-- table grant -- Supabase does not grant it implicitly. This is the founder's
-- only read/export/delete path in release 1; no browser client is granted it.
revoke all on public.coach_leads from public, anon, authenticated;
grant insert on public.coach_leads to anon, authenticated;
grant select, delete on public.coach_leads to service_role;
