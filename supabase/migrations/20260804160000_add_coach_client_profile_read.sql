-- Follow-up to 20260804150000_add_coach_client_linking.sql (never edit an
-- applied migration). That migration let a linked coach read a client's
-- canonical_events/plans but missed profiles -- without this, the coach
-- dashboard roster has no client display name to show.
create policy "linked coaches read their clients' profile" on public.profiles
  for select to authenticated using (
    exists (
      select 1 from public.coach_client_links
      where client_id = profiles.id and coach_id = (select auth.uid()) and status = 'active'
    )
  );
