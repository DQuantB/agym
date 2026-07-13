-- Preserve stable, human/export-visible application identifiers at the persistence boundary.
-- Database primary keys remain UUIDs; client_id lets the browser retain legacy-prefixed
-- IDs without attempting to coerce them into UUIDs.

alter table public.raw_logs
  add column client_id text;

update public.raw_logs
  set client_id = id::text
  where client_id is null;

alter table public.raw_logs
  alter column client_id set not null,
  add constraint raw_logs_client_id_not_blank check (length(trim(client_id)) > 0),
  add constraint raw_logs_user_client_id_key unique (user_id, client_id);

alter table public.canonical_events
  add column client_id text;

update public.canonical_events
  set client_id = id::text
  where client_id is null;

alter table public.canonical_events
  alter column client_id set not null,
  add constraint canonical_events_client_id_not_blank check (length(trim(client_id)) > 0),
  add constraint canonical_events_user_client_id_key unique (user_id, client_id);

create index raw_logs_user_client_id_idx on public.raw_logs (user_id, client_id);
create index canonical_events_user_client_id_idx on public.canonical_events (user_id, client_id);
