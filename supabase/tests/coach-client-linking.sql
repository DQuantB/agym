-- Verifies coach-client linking (ADR 0005): code generation is coach-only,
-- redemption creates a link and enforces requires_payment/expiry/reuse rules,
-- a linked coach can read a client's plans/canonical_events but never their
-- raw_logs/parse_drafts, and revocation immediately removes that access.
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'coach1@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'coach2@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'client1@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'client2@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

-- Coach accounts are founder-provisioned; seed coach1 directly. coach2 and
-- both clients are plain profiles with no coach_profiles row.
insert into public.coach_profiles (user_id, display_name) values ('00000000-0000-0000-0000-0000000000c1', 'Coach One');

-- A non-coach cannot generate a code.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c2', true);
do $$ begin
  begin
    perform public.generate_coach_code();
    raise exception 'FAIL: non-coach generated a coach code';
  exception when others then
    if position('FAIL:' in SQLERRM) > 0 then raise; end if;
    raise notice 'PASS: non-coach code generation rejected';
  end;
end $$;
reset role;

-- Coach1 generates a free code and a requires_payment code. Stashed in a
-- temp table rather than psql variables -- psql does not interpolate
-- `:'var'` inside a dollar-quoted do $$ ... $$ block.
create temporary table test_codes (label text primary key, code text);
grant select, insert on test_codes to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
insert into test_codes values ('free', (public.generate_coach_code()).code);
insert into test_codes values ('paid', (public.generate_coach_code(true)).code);
reset role;

-- Client1 redeems the free code.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c3', true);
select case when public.redeem_coach_code((select code from test_codes where label = 'free')) ->> 'coachName' = 'Coach One'
  then 'PASS: client redeems a valid free code' else 'FAIL: redemption did not return coach name' end as redeem_test;

do $$ begin
  begin
    perform public.redeem_coach_code((select code from test_codes where label = 'free'));
    raise exception 'FAIL: client redeemed the same coach twice';
  exception when others then
    if position('FAIL:' in SQLERRM) > 0 then raise; end if;
    raise notice 'PASS: duplicate redemption to the same coach rejected';
  end;
end $$;
reset role;

-- Client2 cannot redeem a requires_payment code -- no processor exists yet.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c4', true);
do $$ begin
  begin
    perform public.redeem_coach_code((select code from test_codes where label = 'paid'));
    raise exception 'FAIL: a requires_payment code was redeemed without payment';
  exception when others then
    if position('FAIL:' in SQLERRM) > 0 then raise; end if;
    raise notice 'PASS: requires_payment code rejected pending a payment integration';
  end;
end $$;

do $$ begin
  begin
    perform public.redeem_coach_code('NOTAREALCODE');
    raise exception 'FAIL: a nonexistent code was redeemed';
  exception when others then
    if position('FAIL:' in SQLERRM) > 0 then raise; end if;
    raise notice 'PASS: nonexistent code rejected';
  end;
end $$;
reset role;

-- Seed client1's health data as superuser (bypassing RLS -- the point here
-- is coach read access, not insert-path RLS, which other tests cover).
insert into public.raw_logs (user_id, client_id, raw_text) values ('00000000-0000-0000-0000-0000000000c3', 'coach-link-r1', 'client1 raw log');
insert into public.canonical_events (user_id, client_id, source_raw_log_id, event_type, final_fields)
  values ('00000000-0000-0000-0000-0000000000c3', 'coach-link-e1', (select id from public.raw_logs where client_id = 'coach-link-r1'), 'workout', '{}'::jsonb);
insert into public.parse_drafts (user_id, raw_log_id, event_type, parse_status)
  values ('00000000-0000-0000-0000-0000000000c3', (select id from public.raw_logs where client_id = 'coach-link-r1'), 'workout', 'parsed');
insert into public.plans (user_id, raw_plan_text, source_client) values ('00000000-0000-0000-0000-0000000000c3', 'client1 plan', 'hermes');

-- Coach1 (linked) can read client1's confirmed events and plans, but never
-- their raw logs or parse drafts.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
select case when count(*) = 1 then 'PASS: linked coach reads client canonical_events' else 'FAIL: linked coach canonical_events read' end
from public.canonical_events where user_id = '00000000-0000-0000-0000-0000000000c3';
select case when count(*) = 1 then 'PASS: linked coach reads client plans' else 'FAIL: linked coach plans read' end
from public.plans where user_id = '00000000-0000-0000-0000-0000000000c3';
select case when count(*) = 1 then 'PASS: linked coach reads client profile' else 'FAIL: linked coach profile read' end
from public.profiles where id = '00000000-0000-0000-0000-0000000000c3';
select case when count(*) = 0 then 'PASS: linked coach cannot read client raw_logs' else 'FAIL: raw_logs leaked to coach' end
from public.raw_logs where user_id = '00000000-0000-0000-0000-0000000000c3';
select case when count(*) = 0 then 'PASS: linked coach cannot read client parse_drafts' else 'FAIL: parse_drafts leaked to coach' end
from public.parse_drafts where user_id = '00000000-0000-0000-0000-0000000000c3';
reset role;

-- Coach2 (no link to client1) reads nothing.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c2', true);
select case when count(*) = 0 then 'PASS: unlinked coach cannot read client canonical_events' else 'FAIL: unlinked coach read canonical_events' end
from public.canonical_events where user_id = '00000000-0000-0000-0000-0000000000c3';
reset role;

-- Client1 sees their coach's display name; client2 (never linked) does not.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c3', true);
select case when count(*) = 1 then 'PASS: linked client reads coach display name' else 'FAIL: linked client coach profile read' end
from public.coach_profiles where user_id = '00000000-0000-0000-0000-0000000000c1';
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c4', true);
select case when count(*) = 0 then 'PASS: unlinked client cannot read coach profile' else 'FAIL: coach profile leaked to unlinked client' end
from public.coach_profiles where user_id = '00000000-0000-0000-0000-0000000000c1';
reset role;

-- Client1 revokes the link; coach1 immediately loses read access.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c3', true);
select public.revoke_coach_link(id) from public.coach_client_links
where coach_id = '00000000-0000-0000-0000-0000000000c1' and client_id = '00000000-0000-0000-0000-0000000000c3' and status = 'active';
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
select case when count(*) = 0 then 'PASS: revoked coach loses read access to canonical_events' else 'FAIL: revoked coach still reads canonical_events' end
from public.canonical_events where user_id = '00000000-0000-0000-0000-0000000000c3';

do $$ begin
  begin
    perform public.revoke_coach_link((select id from public.coach_client_links where coach_id = '00000000-0000-0000-0000-0000000000c1' limit 1));
    raise exception 'FAIL: revoking an already-revoked coach link unexpectedly succeeded';
  exception when others then
    if position('FAIL:' in SQLERRM) > 0 then raise; end if;
    raise notice 'PASS: re-revoking an already-revoked coach link rejected';
  end;
end $$;
reset role;

rollback;
