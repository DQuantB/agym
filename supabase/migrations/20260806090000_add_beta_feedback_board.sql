-- Beta feedback board: signed-in users report a bug or request a feature
-- and upvote items others already reported instead of duplicating them.
-- Anonymous to other users -- feedback_items carries no author-facing
-- identity beyond "is this mine" -- because the read policy is a blanket
-- read-all (like exercise_catalogue's), the widest exposure this schema has
-- granted to one user's free text yet. A `status` column lets the founder
-- hide an abusive or PII-containing item (RLS then hides it from everyone
-- but its author) without a delete, matching the immutable-evidence
-- convention used elsewhere in this schema. No admin UI in this slice --
-- hiding/triaging status is a founder action via the Supabase dashboard.

create table public.feedback_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('bug', 'idea')),
  title text not null check (length(trim(title)) between 1 and 120),
  body text not null check (length(trim(body)) between 1 and 2000),
  status text not null default 'open' check (status in ('open', 'planned', 'shipped', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index feedback_items_created_at_idx on public.feedback_items (created_at desc);
create index feedback_items_user_id_idx on public.feedback_items (user_id);

create trigger feedback_items_set_updated_at before update on public.feedback_items
  for each row execute procedure public.set_updated_at();

-- Trusted timestamp, matching raw_logs/coach_leads/etc: a browser payload
-- cannot backdate a submission.
create or replace function public.set_feedback_item_timestamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_at = now();
  return new;
end;
$$;

create trigger feedback_items_trusted_timestamp before insert on public.feedback_items
  for each row execute procedure public.set_feedback_item_timestamp();

alter table public.feedback_items enable row level security;

create policy "authenticated users read visible feedback" on public.feedback_items
  for select to authenticated using (status <> 'hidden' or (select auth.uid()) = user_id);

-- status is pinned to 'open' at insert time -- triage into planned/shipped/
-- hidden is a founder-only transition, since authenticated is never granted
-- update on this table.
create policy "users submit their own feedback" on public.feedback_items
  for insert to authenticated with check ((select auth.uid()) = user_id and status = 'open');

revoke all on public.feedback_items from public, anon;
grant select, insert on public.feedback_items to authenticated;
grant select, update, delete on public.feedback_items to service_role;

-- One vote per user per item -- the primary key IS the one-vote constraint.
-- Deleting your own row un-votes; there is no separate withdraw action.
create table public.feedback_votes (
  item_id uuid not null references public.feedback_items(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (item_id, user_id)
);

create index feedback_votes_item_id_idx on public.feedback_votes (item_id);

alter table public.feedback_votes enable row level security;

create policy "users read all feedback votes" on public.feedback_votes
  for select to authenticated using (true);

create policy "users cast their own vote" on public.feedback_votes
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "users withdraw their own vote" on public.feedback_votes
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.feedback_votes from public, anon;
grant select, insert, delete on public.feedback_votes to authenticated;
grant select, delete on public.feedback_votes to service_role;
