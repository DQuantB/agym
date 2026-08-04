-- Coach-client linking via a redeemable code (ADR 0005). Deliberately simpler
-- than the consent/scope-grant model in docs/plans/2026-07-23-trainer-dashboard.md:
-- a coach generates a code, a client redeems it from the mobile app, done.
-- `requires_payment` is a schema seam for a future payment gate -- no processor
-- is wired up yet, so redemption of a code with it set simply fails with a
-- clear error rather than silently granting free access or silently charging.
--
-- Coach accounts are founder-provisioned in this first cut (insert a
-- coach_profiles row via the Supabase dashboard/service_role), matching the
-- same manual-review posture as coach_leads. There is no self-serve
-- "become a coach" path yet.

create table public.coach_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 120),
  created_at timestamptz not null default now()
);

create table public.coach_codes (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coach_profiles(user_id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z2-9]{6,12}$'),
  requires_payment boolean not null default false,
  max_uses integer check (max_uses is null or max_uses > 0),
  use_count integer not null default 0 check (use_count >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create table public.coach_client_links (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coach_profiles(user_id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  code_id uuid not null references public.coach_codes(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'revoked')),
  linked_at timestamptz not null default now(),
  revoked_at timestamptz,
  check (coach_id <> client_id),
  check ((status = 'revoked') = (revoked_at is not null))
);

-- A client may relink to the same coach after revoking (e.g. re-redeeming a
-- code), but only one *active* link per coach/client pair at a time.
create unique index coach_client_links_active_pair_idx
  on public.coach_client_links (coach_id, client_id) where status = 'active';

create index coach_codes_coach_idx on public.coach_codes (coach_id);
create index coach_client_links_client_idx on public.coach_client_links (client_id) where status = 'active';
create index coach_client_links_coach_idx on public.coach_client_links (coach_id) where status = 'active';

-- Timestamps are server-generated, matching this schema's established
-- trusted-timestamp convention -- a browser payload cannot backdate a link
-- or forge a revocation time.
create or replace function public.set_coach_link_trusted_timestamps()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.linked_at = now();
    new.revoked_at = null;
    new.status = 'active';
  elsif tg_op = 'UPDATE' then
    if old.status = 'revoked' then
      raise exception 'a revoked coach link cannot be changed further';
    end if;
    if new.status <> 'revoked' then
      raise exception 'a coach link may only be updated to revoke it';
    end if;
    if old.coach_id is distinct from new.coach_id
      or old.client_id is distinct from new.client_id
      or old.code_id is distinct from new.code_id
      or old.linked_at is distinct from new.linked_at then
      raise exception 'only the status/revoked_at of a coach link may change';
    end if;
    new.revoked_at = now();
  end if;
  return new;
end;
$$;

create trigger coach_client_links_trusted_timestamps
  before insert or update on public.coach_client_links
  for each row execute procedure public.set_coach_link_trusted_timestamps();

-- Generates a coach's redemption code. Caller must already have a
-- coach_profiles row; there is no self-serve path to create one.
create or replace function public.generate_coach_code(
  p_requires_payment boolean default false,
  p_max_uses integer default null,
  p_expires_at timestamptz default null
)
returns public.coach_codes
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- excludes ambiguous 0/O/1/I
  generated text;
  attempt int := 0;
  new_code public.coach_codes;
begin
  if caller is null then
    raise exception 'generating a coach code requires an authenticated user';
  end if;
  if not exists (select 1 from public.coach_profiles where user_id = caller) then
    raise exception 'only a coach account can generate a coach code';
  end if;

  loop
    attempt := attempt + 1;
    generated := '';
    for i in 1..8 loop
      generated := generated || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    begin
      insert into public.coach_codes (coach_id, code, requires_payment, max_uses, expires_at)
      values (caller, generated, p_requires_payment, p_max_uses, p_expires_at)
      returning * into new_code;
      exit;
    exception when unique_violation then
      if attempt >= 10 then
        raise exception 'could not generate a unique coach code, please retry';
      end if;
    end;
  end loop;

  return new_code;
end;
$$;

-- Redeems a coach code for the calling client, creating the link.
create or replace function public.redeem_coach_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  target public.coach_codes;
  coach_name text;
  new_link public.coach_client_links;
begin
  if caller is null then
    raise exception 'redeeming a coach code requires an authenticated user';
  end if;

  select * into target
  from public.coach_codes
  where code = upper(trim(p_code))
    and active
    and (expires_at is null or expires_at > now())
    and (max_uses is null or use_count < max_uses)
  for update;

  if not found then
    raise exception 'this coach code is invalid, expired, or no longer available';
  end if;

  if target.coach_id = caller then
    raise exception 'you cannot redeem your own coach code';
  end if;

  if target.requires_payment then
    raise exception 'this coach code requires payment, which AGym does not support yet';
  end if;

  if exists (
    select 1 from public.coach_client_links
    where coach_id = target.coach_id and client_id = caller and status = 'active'
  ) then
    raise exception 'you are already linked to this coach';
  end if;

  insert into public.coach_client_links (coach_id, client_id, code_id)
  values (target.coach_id, caller, target.id)
  returning * into new_link;

  update public.coach_codes set use_count = use_count + 1 where id = target.id;

  select display_name into coach_name from public.coach_profiles where user_id = target.coach_id;

  return jsonb_build_object('linkId', new_link.id, 'coachName', coach_name, 'linkedAt', new_link.linked_at);
end;
$$;

-- Revokes the calling client's own active link to a coach. A coach revoking
-- a client is handled by the same update path via the RLS policy below --
-- both sides of the link may end it.
create or replace function public.revoke_coach_link(p_link_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'revoking a coach link requires an authenticated user';
  end if;

  update public.coach_client_links
  set status = 'revoked'
  where id = p_link_id and status = 'active' and (client_id = caller or coach_id = caller);

  if not found then
    raise exception 'no active coach link found for this account';
  end if;
end;
$$;

alter table public.coach_profiles enable row level security;
alter table public.coach_codes enable row level security;
alter table public.coach_client_links enable row level security;

create policy "coaches read their own profile" on public.coach_profiles
  for select to authenticated using ((select auth.uid()) = user_id);

-- A linked client can see their coach's display name (e.g. "linked to Jane").
create policy "linked clients read their coach's profile" on public.coach_profiles
  for select to authenticated using (
    exists (
      select 1 from public.coach_client_links
      where coach_id = coach_profiles.user_id and client_id = (select auth.uid()) and status = 'active'
    )
  );

create policy "coaches read their own codes" on public.coach_codes
  for select to authenticated using ((select auth.uid()) = coach_id);

create policy "coaches read their own client links" on public.coach_client_links
  for select to authenticated using ((select auth.uid()) = coach_id);
create policy "clients read their own coach links" on public.coach_client_links
  for select to authenticated using ((select auth.uid()) = client_id);
create policy "either side revokes an active coach link" on public.coach_client_links
  for update to authenticated
  using ((select auth.uid()) in (coach_id, client_id))
  with check ((select auth.uid()) in (coach_id, client_id));

-- A linked coach may read a client's confirmed outcomes and plan history --
-- never raw_logs or parse_drafts (per ADR 0005: read the same kind of data
-- the Coach Briefing already exposes to the client themselves, not raw
-- unconfirmed input).
create policy "linked coaches read their clients' canonical events" on public.canonical_events
  for select to authenticated using (
    exists (
      select 1 from public.coach_client_links
      where client_id = canonical_events.user_id and coach_id = (select auth.uid()) and status = 'active'
    )
  );

create policy "linked coaches read their clients' plans" on public.plans
  for select to authenticated using (
    exists (
      select 1 from public.coach_client_links
      where client_id = plans.user_id and coach_id = (select auth.uid()) and status = 'active'
    )
  );

revoke all on public.coach_profiles, public.coach_codes, public.coach_client_links from public, anon;
grant select on public.coach_profiles to authenticated;
grant select on public.coach_codes to authenticated;
grant select, update on public.coach_client_links to authenticated;
grant execute on function public.generate_coach_code(boolean, integer, timestamptz) to authenticated;
grant execute on function public.redeem_coach_code(text) to authenticated;
grant execute on function public.revoke_coach_link(uuid) to authenticated;
