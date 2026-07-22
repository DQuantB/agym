import type { SupabaseClient } from '@supabase/supabase-js';
import { expect, it, vi } from 'vitest';

import { loadCalendarPlans } from './calendarApi';

const planData = {
  kind: 'gym_workout', schema_version: 1, scheduled_for: '2026-07-22', title: 'Upper strength',
  exercises: [{ client_id: 'bench-press', name: 'Bench press', sets: [{ reps: 5, weight_kg: 80 }], }],
};

it('reads the plans table source_client field and preserves proposal versus active status', async () => {
  const result = { data: [
    { id: '11111111-1111-4111-8111-111111111111', status: 'proposed', plan_data: planData, source_client: 'hermes', created_at: '2026-07-21T09:00:00Z' },
    { id: '22222222-2222-4222-8222-222222222222', status: 'active', plan_data: planData, source_client: 'claude-code', created_at: '2026-07-20T09:00:00Z' },
  ], error: null };
  const query: Record<string, ReturnType<typeof vi.fn>> & PromiseLike<typeof result> = {} as never;
  for (const method of ['select', 'in', 'eq', 'is', 'order', 'limit']) query[method] = vi.fn(() => query);
  query.then = (resolve) => Promise.resolve(result).then(resolve);
  const from = vi.fn(() => query);

  const plans = await loadCalendarPlans({ from } as unknown as SupabaseClient);

  expect(query.select).toHaveBeenCalledWith('id, status, plan_data, source_client, created_at');
  expect(plans.proposal).toMatchObject({ status: 'proposed', source: 'hermes', plan: { title: 'Upper strength' } });
  expect(plans.active).toMatchObject({ status: 'active', source: 'claude-code' });
});
