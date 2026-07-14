-- User-initiated account deletion (product constraint #8: users own their data;
-- delete must be supported). Raw logs are intentionally not directly deletable
-- from the browser so evidence cannot be silently rewritten; full account
-- erasure is the deliberate, audited path referenced by the schema comments.
--
-- Deleting the auth.users row cascades through profiles to every user-owned
-- table (raw_logs, parse_drafts, canonical_events, plans, agent_authorizations,
-- agent_audit_log, consent_records) via existing ON DELETE CASCADE constraints.
-- The cascade is enforced at the constraint level, so it correctly removes rows
-- that RLS blocks the user from deleting directly.

create or replace function public.delete_my_account()
  returns void
  language plpgsql
  security definer
  set search_path to ''
as $$
declare
  caller uuid := auth.uid();
begin
  -- Only an authenticated caller can erase their own account, and only ever
  -- their own: the function derives the target from the verified JWT, never
  -- from a caller-supplied argument.
  if caller is null then
    raise exception 'account deletion requires an authenticated user';
  end if;

  delete from auth.users where id = caller;
end;
$$;

-- SECURITY DEFINER functions grant EXECUTE to PUBLIC by default. Restrict to
-- authenticated end users; the anonymous role and service_role (the MCP agent
-- identity) must not be able to erase accounts.
revoke execute on function public.delete_my_account() from public;
revoke execute on function public.delete_my_account() from anon;
revoke execute on function public.delete_my_account() from service_role;
grant execute on function public.delete_my_account() to authenticated;
