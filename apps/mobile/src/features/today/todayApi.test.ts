import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import { loadTodayRemoteData } from './todayApi';

type Result = { data?: unknown; error?: { message: string } | null };
function chain(result: Result) {
  const resolved = { data: null, error: null, ...result };
  const value: Record<string, ReturnType<typeof vi.fn>> & PromiseLike<typeof resolved> = {} as never;
  for (const method of ['select', 'eq', 'is', 'order', 'limit']) value[method] = vi.fn(() => value);
  value.maybeSingle = vi.fn(async () => resolved);
  value.then = (resolve) => Promise.resolve(resolved).then(resolve);
  return value;
}

const activeRow = {
  id: '11111111-1111-4111-8111-111111111111', scheduled_for: '2026-07-21',
  plan_data: { kind: 'gym_workout', schema_version: 1, scheduled_for: '2026-07-21', title: 'Lower strength', exercises: [{ client_id: 'squat', name: 'Back squat', sets: [{ reps: 5 }] }] },
};

describe('loadTodayRemoteData', () => {
  it('keeps active and proposed plan queries separate, then loads execution only for active intent', async () => {
    const active = chain({ data: activeRow });
    const proposed = chain({ data: null });
    const execution = chain({ data: null });
    let plansCalls = 0;
    const from = vi.fn((table: string) => {
      if (table === 'plans') return plansCalls++ === 0 ? active : proposed;
      if (table === 'workout_executions') return execution;
      throw new Error(`unexpected table ${table}`);
    });
    const result = await loadTodayRemoteData({ from } as unknown as SupabaseClient, '2026-07-21');

    expect(active.eq).toHaveBeenCalledWith('status', 'active');
    expect(proposed.eq).toHaveBeenCalledWith('status', 'proposed');
    expect(active.eq).toHaveBeenCalledWith('plan_data->>kind', 'gym_workout');
    expect(proposed.eq).toHaveBeenCalledWith('plan_data->>kind', 'gym_workout');
    expect(execution.eq).toHaveBeenCalledWith('plan_id', activeRow.id);
    expect(result).toMatchObject({ activePlan: { id: activeRow.id, title: 'Lower strength' }, execution: null, proposal: null });
  });

  it('does not query executions when only an unapplied proposal exists', async () => {
    const active = chain({ data: null });
    const proposed = chain({ data: activeRow });
    let plansCalls = 0;
    const from = vi.fn((table: string) => {
      if (table !== 'plans') throw new Error('execution query must not happen for a proposal');
      return plansCalls++ === 0 ? active : proposed;
    });
    const result = await loadTodayRemoteData({ from } as unknown as SupabaseClient, '2026-07-21');

    expect(result).toMatchObject({ activePlan: null, execution: null, proposal: { id: activeRow.id } });
  });
});
