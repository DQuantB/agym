import type { SupabaseClient } from '@supabase/supabase-js';
import { expect, it, vi } from 'vitest';

import { acceptCalendarProposal, acceptCalendarProposals, findActivePlanConflicts, loadCalendarPlans } from './calendarApi';

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
  const rpc = vi.fn().mockResolvedValue({ error: null });
  await acceptCalendarProposal({ rpc } as unknown as SupabaseClient, '11111111-1111-4111-8111-111111111111');
  expect(rpc).toHaveBeenCalledWith('accept_gym_workout_plan', { p_plan_id: '11111111-1111-4111-8111-111111111111' });

  rpc.mockResolvedValueOnce({ error: { message: 'gym plan is not awaiting acceptance' } });
  await expect(acceptCalendarProposal({ rpc } as unknown as SupabaseClient, '11111111-1111-4111-8111-111111111111')).rejects.toThrow('AGYM could not accept this Gym proposal: gym plan is not awaiting acceptance');
});

it('accepts every occurrence of a repeated plan and reports partial failures instead of aborting the batch', async () => {
  const rpc = vi.fn()
    .mockResolvedValueOnce({ error: null })
    .mockResolvedValueOnce({ error: { message: 'gym plan was not found for this account' } })
    .mockResolvedValueOnce({ error: null });

  const result = await acceptCalendarProposals({ rpc } as unknown as SupabaseClient, ['mon', 'wed', 'fri']);

  expect(rpc).toHaveBeenNthCalledWith(1, 'accept_gym_workout_plan', { p_plan_id: 'mon' });
  expect(rpc).toHaveBeenNthCalledWith(2, 'accept_gym_workout_plan', { p_plan_id: 'wed' });
  expect(rpc).toHaveBeenNthCalledWith(3, 'accept_gym_workout_plan', { p_plan_id: 'fri' });
  expect(result.accepted).toEqual(['mon', 'fri']);
  expect(result.failed).toEqual([{ id: 'wed', message: 'AGYM could not accept this Gym proposal: gym plan was not found for this account' }]);
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
