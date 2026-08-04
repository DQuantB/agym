import type { SupabaseClient } from '@supabase/supabase-js';
import { expect, it, vi } from 'vitest';

import { acceptCalendarProposal, acceptCalendarProposals, findActivePlanConflicts, loadCalendarPlans, loadSupersededPlansByDate, restoreSupersededPlan } from './calendarApi';

const planData = {
  kind: 'gym_workout', schema_version: 1, scheduled_for: '2026-07-22', title: 'Upper strength',
  exercises: [{ client_id: 'bench-press', name: 'Bench press', sets: [{ reps: 5, weight_kg: 80 }], }],
};

it('reads the plans table scheduled_for column and splits proposals from scheduled active plans', async () => {
  const result = { data: [
    { id: '11111111-1111-4111-8111-111111111111', status: 'proposed', plan_data: planData, source_client: 'hermes', created_at: '2026-07-21T09:00:00Z', scheduled_for: '2026-07-22' },
    { id: '22222222-2222-4222-8222-222222222222', status: 'active', plan_data: planData, user_revision_data: { ...planData, title: 'User-adjusted upper strength' }, source_client: 'claude-code', created_at: '2026-07-20T09:00:00Z', scheduled_for: '2026-07-23' },
  ], error: null };
  const query: Record<string, ReturnType<typeof vi.fn>> & PromiseLike<typeof result> = {} as never;
  for (const method of ['select', 'in', 'eq', 'is', 'order', 'limit']) query[method] = vi.fn(() => query);
  query.then = (resolve) => Promise.resolve(result).then(resolve);
  const from = vi.fn(() => query);

  const plans = await loadCalendarPlans({ from } as unknown as SupabaseClient);

  expect(query.select).toHaveBeenCalledWith('id, status, plan_data, user_revision_data, source_client, created_at, scheduled_for');
  expect(plans.proposals).toHaveLength(1);
  expect(plans.scheduled).toHaveLength(1);
  expect(plans.proposals[0]).toMatchObject({ status: 'proposed', source: 'hermes', scheduledFor: '2026-07-22', plan: { title: 'Upper strength' } });
  expect(plans.scheduled[0]).toMatchObject({ status: 'active', source: 'claude-code', scheduledFor: '2026-07-23', plan: { title: 'User-adjusted upper strength' } });
});

it('accepts a proposal only through the owner-scoped RPC and surfaces its error', async () => {
  const rpc = vi.fn().mockResolvedValue({ data: { plan: {}, superseded: null }, error: null });
  const result = await acceptCalendarProposal({ rpc } as unknown as SupabaseClient, '11111111-1111-4111-8111-111111111111');
  expect(rpc).toHaveBeenCalledWith('accept_gym_workout_plan', { p_plan_id: '11111111-1111-4111-8111-111111111111' });
  expect(result).toEqual({ supersededTitle: null });

  rpc.mockResolvedValueOnce({ error: { message: 'gym plan is not awaiting acceptance' } });
  await expect(acceptCalendarProposal({ rpc } as unknown as SupabaseClient, '11111111-1111-4111-8111-111111111111')).rejects.toThrow('AGYM could not accept this Gym proposal: gym plan is not awaiting acceptance');
});

it('finds active plans of the same category already on the given dates', async () => {
  const result = { data: [{ id: 'existing-1', scheduled_for: '2026-07-22' }], error: null };
  const query: Record<string, ReturnType<typeof vi.fn>> & PromiseLike<typeof result> = {} as never;
  for (const method of ['select', 'eq', 'in', 'is']) query[method] = vi.fn(() => query);
  query.then = (resolve) => Promise.resolve(result).then(resolve);
  const from = vi.fn(() => query);

  const conflicts = await findActivePlanConflicts({ from } as unknown as SupabaseClient, 'gym_workout', ['2026-07-22', '2026-07-24']);

  expect(query.eq).toHaveBeenCalledWith('status', 'active');
  expect(query.eq).toHaveBeenCalledWith('plan_data->>kind', 'gym_workout');
  expect(query.in).toHaveBeenCalledWith('scheduled_for', ['2026-07-22', '2026-07-24']);
  expect(conflicts).toEqual([{ id: 'existing-1', scheduledFor: '2026-07-22' }]);
});

it('skips the query entirely when there are no dates to check', async () => {
  const from = vi.fn();
  const conflicts = await findActivePlanConflicts({ from } as unknown as SupabaseClient, 'gym_workout', []);
  expect(conflicts).toEqual([]);
  expect(from).not.toHaveBeenCalled();
});

it('reports which previous plan an acceptance replaced', async () => {
  const rpc = vi.fn().mockResolvedValue({ data: { plan: {}, superseded: { id: '33333333-3333-4333-8333-333333333333', title: 'Old bench day' } }, error: null });
  const result = await acceptCalendarProposal({ rpc } as unknown as SupabaseClient, '11111111-1111-4111-8111-111111111111');
  expect(result).toEqual({ supersededTitle: 'Old bench day' });
});

it('loads the most recent superseded plan per date, keyed by scheduled_for', async () => {
  const result = { data: [
    { id: 'newest', plan_data: { ...planData, title: 'Newer replaced plan' }, scheduled_for: '2026-07-22', updated_at: '2026-07-21T10:00:00Z' },
    { id: 'oldest', plan_data: { ...planData, title: 'Oldest replaced plan' }, scheduled_for: '2026-07-22', updated_at: '2026-07-20T10:00:00Z' },
    { id: 'other-date', plan_data: { ...planData, title: 'Different day' }, scheduled_for: '2026-07-23', updated_at: '2026-07-19T10:00:00Z' },
  ], error: null };
  const query: Record<string, ReturnType<typeof vi.fn>> & PromiseLike<typeof result> = {} as never;
  for (const method of ['select', 'eq', 'is', 'order', 'limit']) query[method] = vi.fn(() => query);
  query.then = (resolve) => Promise.resolve(result).then(resolve);
  const from = vi.fn(() => query);

  const byDate = await loadSupersededPlansByDate({ from } as unknown as SupabaseClient);

  expect(byDate.get('2026-07-22')).toEqual({ id: 'newest', title: 'Newer replaced plan' });
  expect(byDate.get('2026-07-23')).toEqual({ id: 'other-date', title: 'Different day' });
  expect(byDate.size).toBe(2);
});

it('restores a superseded plan through the owner-scoped RPC, reporting both plan titles', async () => {
  const rpc = vi.fn().mockResolvedValue({
    data: { plan: { plan_data: planData }, superseded: { id: '44444444-4444-4444-8444-444444444444', title: 'Bumped plan' } },
    error: null,
  });
  const result = await restoreSupersededPlan({ rpc } as unknown as SupabaseClient, '11111111-1111-4111-8111-111111111111');
  expect(rpc).toHaveBeenCalledWith('restore_superseded_gym_plan', { p_plan_id: '11111111-1111-4111-8111-111111111111' });
  expect(result).toEqual({ restoredTitle: 'Upper strength', supersededTitle: 'Bumped plan' });
});

it('flattens a bulk-accept batch into per-id results, keeping partial failures visible', async () => {
  const rpc = vi.fn().mockResolvedValue({
    data: { results: [
      { id: 'mon', ok: true, result: { plan: {}, superseded: null } },
      { id: 'wed', ok: true, result: { plan: {}, superseded: { id: 'old-wed', title: 'Old Wednesday' } } },
      { id: 'fri', ok: false, error: 'gym plan is not awaiting acceptance' },
    ] },
    error: null,
  });
  const results = await acceptCalendarProposals({ rpc } as unknown as SupabaseClient, ['mon', 'wed', 'fri']);
  expect(rpc).toHaveBeenCalledWith('accept_gym_workout_plans', { p_plan_ids: ['mon', 'wed', 'fri'] });
  expect(results).toEqual([
    { id: 'mon', ok: true, supersededTitle: null },
    { id: 'wed', ok: true, supersededTitle: 'Old Wednesday' },
    { id: 'fri', ok: false, error: 'gym plan is not awaiting acceptance' },
  ]);
});

it('returns an empty result list when the bulk RPC response has no results array', async () => {
  const rpc = vi.fn().mockResolvedValue({ data: {}, error: null });
  const results = await acceptCalendarProposals({ rpc } as unknown as SupabaseClient, ['mon']);
  expect(results).toEqual([]);
});
