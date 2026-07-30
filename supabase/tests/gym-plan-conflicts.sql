\set ON_ERROR_STOP on

-- Advisory same-date conflict detection (gym_plan_conflicts, wired into both
-- create_mcp_proposed_plan and remote_mcp_create_proposed_plan). Exercised
-- here via the remote path, which is reachable from this role the same way
-- supabase/tests/remote-mcp-scheduling.sql reaches it. Fixed dates, not
-- current_date, keep assertions stable regardless of when this runs.

begin;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-4000-8000-0000000000c1',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'conflict-owner@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.agent_authorizations (user_id, agent_identifier, action)
values ('00000000-0000-4000-8000-0000000000c1', 'remote-mcp', 'write_proposed_plan');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000c1', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated","client_id":"conflict-test"}', true);

-- 1) First proposal for a date with no other gym plan: clean check.
-- 2) Second proposal, same date: the routine "ask for changes" revision loop
-- is notice tier only, and it must still be created.
-- Both steps run in one block: the restrictive "OAuth MCP clients cannot use
-- plans directly" policy means this authenticated+client_id session cannot
-- SELECT public.plans itself (by design) to look the first id back up, so
-- the first RPC's own return value is the only source for it.
do $$
declare
  first jsonb;
  first_id uuid;
  second jsonb;
begin
  first := public.remote_mcp_create_proposed_plan(
    'First August 1st proposal',
    '{"kind":"gym_workout","schema_version":1,"scheduled_for":"2026-08-01","title":"Session A","exercises":[{"client_id":"squat","name":"Back squat","sets":[{"reps":5,"weight_kg":100,"rest_seconds":120}]}]}'::jsonb
  );
  if first->'conflicts'->>'checked' <> 'true' or first->'conflicts'->>'severity' <> 'none' then
    raise exception 'FAIL: first proposal should report no conflict: %', first->'conflicts';
  end if;
  raise notice 'PASS: first proposal for a clean date reports severity=none';

  first_id := (first->'plan'->>'id')::uuid;
  second := public.remote_mcp_create_proposed_plan(
    'Second August 1st proposal',
    '{"kind":"gym_workout","schema_version":1,"scheduled_for":"2026-08-01","title":"Session A revised","exercises":[{"client_id":"squat","name":"Back squat","sets":[{"reps":5,"weight_kg":102.5,"rest_seconds":120}]}]}'::jsonb
  );
  if second->'conflicts'->>'severity' <> 'notice' then
    raise exception 'FAIL: duplicate same-date proposal should be notice tier: %', second->'conflicts';
  end if;
  if not (second->'conflicts'->'reasons' ? 'duplicate_proposal') then
    raise exception 'FAIL: expected duplicate_proposal reason: %', second->'conflicts'->'reasons';
  end if;
  if (second->'conflicts'->'counts'->>'proposed')::int <> 1 then
    raise exception 'FAIL: expected exactly one competing proposed plan: %', second->'conflicts'->'counts';
  end if;
  if not exists (select 1 from jsonb_array_elements(second->'conflicts'->'plans') p where (p->>'id')::uuid = first_id) then
    raise exception 'FAIL: conflicting plan entry should reference the first proposal';
  end if;
  raise notice 'PASS: second same-date proposal reports severity=notice with duplicate_proposal';
end;
$$;

-- 3) Elevate the first plan to active (direct UPDATE as the migration owner --
-- this file is not exercising accept_gym_workout_plan or its RLS boundary,
-- see gym-plan-acceptance.sql for that) and confirm acceptance turns the
-- same-date conflict into a warning, and that it is still advisory only.
-- Plan counts are read via postgres (reset role): the same restrictive OAuth
-- policy that blocks steps 1-2 from reading public.plans directly also
-- blocks a plain count(*) here.
reset role;
update public.plans set status = 'active'
where user_id = '00000000-0000-4000-8000-0000000000c1' and raw_plan_text = 'First August 1st proposal';

select count(*) as plan_count_before from public.plans where user_id = '00000000-0000-4000-8000-0000000000c1';
\gset

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000c1', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated","client_id":"conflict-test"}', true);

do $$
declare
  created jsonb;
begin
  created := public.remote_mcp_create_proposed_plan(
    'Third August 1st proposal',
    '{"kind":"gym_workout","schema_version":1,"scheduled_for":"2026-08-01","title":"Session A conflicting","exercises":[{"client_id":"squat","name":"Back squat","sets":[{"reps":5,"weight_kg":105,"rest_seconds":120}]}]}'::jsonb
  );
  if created->'conflicts'->>'severity' <> 'warning' then
    raise exception 'FAIL: proposing against an accepted plan should be warning tier: %', created->'conflicts';
  end if;
  if not (created->'conflicts'->'reasons' ? 'active_plan_accepted') then
    raise exception 'FAIL: expected active_plan_accepted reason: %', created->'conflicts'->'reasons';
  end if;
  if (created->'conflicts'->'counts'->>'active')::int <> 1 then
    raise exception 'FAIL: expected exactly one competing active plan: %', created->'conflicts'->'counts';
  end if;
  if created->'plan'->>'status' <> 'proposed' then
    raise exception 'FAIL: a conflict must never block plan creation';
  end if;
  raise notice 'PASS: proposing against an accepted plan is advisory (warning) and never blocks creation';
end;
$$;

-- The most important assertion in this file: a warning-tier conflict must
-- still have created exactly one new plan row, never blocked.
reset role;
select case when count(*) = :plan_count_before + 1
  then 'PASS: a warning-tier conflict still created exactly one new plan row'
  else 'FAIL: expected exactly one new plan row, before=' || :plan_count_before || ' after=' || count(*)
  end
from public.plans where user_id = '00000000-0000-4000-8000-0000000000c1';

-- 4) The active plan is now user-revised and already has a linked execution:
-- both amplifier reasons must surface alongside active_plan_accepted.
reset role;
update public.plans
set user_revision_data = '{"kind":"gym_workout","schema_version":1,"scheduled_for":"2026-08-01","title":"Session A hand-revised","exercises":[]}'::jsonb,
    user_revision_updated_at = now()
where user_id = '00000000-0000-4000-8000-0000000000c1' and raw_plan_text = 'First August 1st proposal';

insert into public.workout_executions (user_id, plan_id, scheduled_for, planned_snapshot, status, completed_at)
select user_id, id, scheduled_for, plan_data, 'completed', now()
from public.plans
where user_id = '00000000-0000-4000-8000-0000000000c1' and raw_plan_text = 'First August 1st proposal';

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000c1', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated","client_id":"conflict-test"}', true);

do $$
declare
  created jsonb;
begin
  created := public.remote_mcp_create_proposed_plan(
    'Fourth August 1st proposal',
    '{"kind":"gym_workout","schema_version":1,"scheduled_for":"2026-08-01","title":"Session A amplified","exercises":[{"client_id":"squat","name":"Back squat","sets":[{"reps":5,"weight_kg":107.5,"rest_seconds":120}]}]}'::jsonb
  );
  if not (created->'conflicts'->'reasons' ? 'active_plan_user_revised') then
    raise exception 'FAIL: expected active_plan_user_revised reason: %', created->'conflicts'->'reasons';
  end if;
  if not (created->'conflicts'->'reasons' ? 'active_plan_has_execution') then
    raise exception 'FAIL: expected active_plan_has_execution reason: %', created->'conflicts'->'reasons';
  end if;
  raise notice 'PASS: a hand-revised, already-executed active plan surfaces both amplifier reasons';
end;
$$;

-- 5) A different date has no conflict: detection is scoped to the exact date.
do $$
declare
  created jsonb;
begin
  created := public.remote_mcp_create_proposed_plan(
    'August 2nd proposal',
    '{"kind":"gym_workout","schema_version":1,"scheduled_for":"2026-08-02","title":"Session B","exercises":[{"client_id":"bench","name":"Bench press","sets":[{"reps":5,"weight_kg":80,"rest_seconds":120}]}]}'::jsonb
  );
  if created->'conflicts'->>'severity' <> 'none' then
    raise exception 'FAIL: a different date must not report a conflict: %', created->'conflicts';
  end if;
  raise notice 'PASS: conflict detection is scoped to the exact scheduled date';
end;
$$;

-- 6) Soft-deleted plans must not count as conflicts. Delete the second
-- proposal, then confirm a new same-date proposal only sees the two
-- surviving proposed plans (third, fourth) plus the one active plan.
reset role;
update public.plans set deleted_at = now()
where user_id = '00000000-0000-4000-8000-0000000000c1' and raw_plan_text = 'Second August 1st proposal';

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000c1', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated","client_id":"conflict-test"}', true);

do $$
declare
  created jsonb;
begin
  created := public.remote_mcp_create_proposed_plan(
    'Fifth August 1st proposal',
    '{"kind":"gym_workout","schema_version":1,"scheduled_for":"2026-08-01","title":"Session A after soft-delete","exercises":[{"client_id":"squat","name":"Back squat","sets":[{"reps":5,"weight_kg":110,"rest_seconds":120}]}]}'::jsonb
  );
  if (created->'conflicts'->'counts'->>'proposed')::int <> 2 then
    raise exception 'FAIL: soft-deleted proposal must not be counted, got counts=%', created->'conflicts'->'counts';
  end if;
  raise notice 'PASS: a soft-deleted plan is excluded from conflict counts';
end;
$$;

-- 7) A non-gym payload has no date semantics: the check is skipped entirely,
-- not treated as a conflict, and the plan is still created with a null date.
do $$
declare
  created jsonb;
begin
  created := public.remote_mcp_create_proposed_plan('Non-gym proposal', '{}'::jsonb);
  if created->'conflicts'->>'checked' <> 'false' or created->'conflicts'->>'severity' <> 'none' then
    raise exception 'FAIL: non-gym plan should skip the conflict check entirely: %', created->'conflicts';
  end if;
  if created->'plan'->'scheduled_for' is distinct from 'null'::jsonb then
    raise exception 'FAIL: non-gym plan should have a null scheduled_for: %', created->'plan'->'scheduled_for';
  end if;
  raise notice 'PASS: non-gym plans skip the conflict check without erroring';
end;
$$;

-- 8) The conflict helper bypasses RLS by design (it takes p_user_id as a
-- caller-supplied argument), so it must not be directly callable by any
-- authenticated session, OAuth or browser.
do $$
begin
  begin
    perform public.gym_plan_conflicts('00000000-0000-4000-8000-0000000000c1'::uuid, '2026-08-01'::date, null);
    raise exception 'FAIL: gym_plan_conflicts unexpectedly callable by authenticated';
  exception when insufficient_privilege then
    raise notice 'PASS: gym_plan_conflicts is not directly callable by authenticated';
  end;
end;
$$;

-- 9) create_mcp_proposed_plan was DROP + CREATE'd to change its return type.
-- Re-confirm it is still service_role-only after being recreated (duplicates
-- the assertion in rls-isolation.sql; kept here too since this file is the
-- one that ships the DROP, and these files run independently by hand). The
-- EXECUTE privilege check happens before the function body runs, so a NULL
-- authorization id below does not affect this outcome -- and this session
-- cannot read agent_authorizations directly to fetch a real one anyway,
-- same restrictive OAuth policy as the plans reads above.
do $$
begin
  begin
    perform public.create_mcp_proposed_plan(
      '00000000-0000-4000-8000-0000000000c1',
      null,
      'remote-mcp',
      'Browser bypass attempt',
      '{}'::jsonb
    );
    raise exception 'FAIL: create_mcp_proposed_plan (service_role-only RPC) unexpectedly succeeded for authenticated';
  exception when insufficient_privilege then
    raise notice 'PASS: create_mcp_proposed_plan remains service_role-only after being recreated';
  end;
end;
$$;

rollback;
