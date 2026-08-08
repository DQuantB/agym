\set ON_ERROR_STOP on

begin;

-- Anonymous (unauthenticated landing-page visitor) can submit a lead. Anon
-- has no select grant, so verification below runs as service_role instead.
set local role anon;
insert into public.coach_leads (email, coach_name, note)
values ('coach@example.test', 'Example Coach', 'Interested in early access');
reset role;

set local role service_role;
select case when count(*) = 1 then 'PASS: anon can insert a coach lead' else 'FAIL: anon insert did not land' end as anon_insert_test
from public.coach_leads where email = 'coach@example.test';
reset role;

-- Anon cannot read back any lead, including the one it just inserted -- no
-- enumeration, no confirmation a given email already signed up.
do $$
begin
  begin
    set local role anon;
    perform 1 from public.coach_leads limit 1;
    raise exception 'FAIL: anon select unexpectedly succeeded';
  exception when insufficient_privilege then
    raise notice 'PASS: anon select rejected';
  end;
end;
$$;
reset role;

-- Anon cannot update or delete an existing lead.
do $$
begin
  begin
    set local role anon;
    update public.coach_leads set note = 'tampered' where email = 'coach@example.test';
    raise exception 'FAIL: anon update unexpectedly succeeded';
  exception when insufficient_privilege then
    raise notice 'PASS: anon update rejected';
  end;
end;
$$;
reset role;

do $$
begin
  begin
    set local role anon;
    delete from public.coach_leads where email = 'coach@example.test';
    raise exception 'FAIL: anon delete unexpectedly succeeded';
  exception when insufficient_privilege then
    raise notice 'PASS: anon delete rejected';
  end;
end;
$$;
reset role;

-- A malformed email is rejected by the check constraint regardless of role.
do $$
begin
  begin
    set local role anon;
    insert into public.coach_leads (email) values ('not-an-email');
    raise exception 'FAIL: malformed email unexpectedly accepted';
  exception when check_violation then
    raise notice 'PASS: malformed email rejected';
  end;
end;
$$;
reset role;

-- A signed-in AGym user can also submit from the same public form. Same
-- insert-only grant as anon -- authenticated has no select either.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
insert into public.coach_leads (email) values ('authenticated-visitor@example.test');
reset role;

set local role service_role;
select case when count(*) = 1 then 'PASS: authenticated visitor can insert a coach lead' else 'FAIL: authenticated insert did not land' end as authenticated_insert_test
from public.coach_leads where email = 'authenticated-visitor@example.test';
reset role;

-- service_role (server-side/dashboard) retains full read access for export.
set local role service_role;
select case when count(*) = 2 then 'PASS: service_role reads all submitted leads' else 'FAIL: service_role read count mismatch' end as service_role_read_test
from public.coach_leads;
reset role;

rollback;
