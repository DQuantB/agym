-- Phase 6: a public, metadata-only exercise catalogue for optional search/alias
-- UX. This is reference data, not user data -- readable by any authenticated
-- user, writable only by the import script via service_role (which bypasses
-- RLS by default; no client write path is granted). Never stores media: the
-- upstream dataset's images/GIFs are a separate, non-redistributable grant to
-- the repo owner (see docs/research/exercise-dataset-evaluation.md).
create table public.exercise_catalogue (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_id text not null,
  source_commit text not null,
  name text not null check (length(trim(name)) > 0),
  category text not null,
  body_part text not null,
  equipment text not null,
  muscle_group text not null,
  secondary_muscles text[] not null default '{}',
  target text not null,
  instructions jsonb not null,
  instruction_steps jsonb not null,
  created_at timestamptz not null default now(),
  unique (source, source_id)
);

create index exercise_catalogue_name_idx on public.exercise_catalogue (name);
create index exercise_catalogue_body_part_idx on public.exercise_catalogue (body_part);
create index exercise_catalogue_equipment_idx on public.exercise_catalogue (equipment);

alter table public.exercise_catalogue enable row level security;

create policy "authenticated users read the exercise catalogue" on public.exercise_catalogue
  for select to authenticated using (true);

revoke all on public.exercise_catalogue from public, anon;
grant select on public.exercise_catalogue to authenticated;

-- The import script authenticates as service_role and upserts directly; no
-- browser-facing client is ever granted write access to this table.
grant select, insert, update on public.exercise_catalogue to service_role;
