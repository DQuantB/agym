import type { SupabaseClient } from '@supabase/supabase-js';
import type { Mock } from 'vitest';
import { describe, expect, it, vi } from 'vitest';
import { executionFromPlan, gymWorkoutPlanSchema, workoutExecutionDataSchema } from './gymSchemas';
import { completeWorkout, loadWorkout, saveWorkout, startWorkout } from './workoutApi';

const plan = gymWorkoutPlanSchema.parse({
  kind: 'gym_workout',
  schema_version: 1,
  scheduled_for: '2026-07-14',
  title: 'Lower strength',
  exercises: [{ client_id: 'squat', name: 'Back squat', sets: [{ reps: 5, weight_kg: 60, rest_seconds: 180 }] }],
});

const execution = {
  id: 'exec-1',
  plan_id: 'plan-1',
  scheduled_for: '2026-07-14',
  status: 'in_progress' as const,
  planned_snapshot: plan,
  execution_data: executionFromPlan(plan),
  additional_notes: '',
  completed_at: null,
};

interface StubResult {
  data?: unknown;
  error?: { message: string } | null;
}

interface QueryChain {
  select: Mock;
  eq: Mock;
  is: Mock;
  order: Mock;
  limit: Mock;
  insert: Mock;
  update: Mock;
  maybeSingle: Mock;
  single: Mock;
  then: PromiseLike<{ data: unknown; error: { message: string } | null }>['then'];
}

const chainMethods = ['select', 'eq', 'is', 'order', 'limit', 'insert', 'update'] as const;

// Chainable Supabase query-builder stub. Every intermediate method returns
// the same object so `.eq().is().order().limit()` chains resolve to one
// terminal call, mirroring how the real supabase-js builder behaves. The
// chain is also directly thenable so `saveWorkout`, which awaits
// `update().eq(...)` without a terminal selector, resolves correctly too.
function makeChain(result: StubResult): QueryChain {
  const resolved = { data: null, error: null, ...result };
  const chain = {} as QueryChain;
  for (const method of chainMethods) {
    chain[method] = vi.fn(() => chain);
  }
  chain.maybeSingle = vi.fn(async () => resolved);
  chain.single = vi.fn(async () => resolved);
  chain.then = ((onFulfilled) => Promise.resolve(resolved).then(onFulfilled)) as QueryChain['then'];
  return chain;
}

function makeClient(chains: Record<string, QueryChain>, rpcResult?: StubResult) {
  const resolvedRpc = { data: null, error: null, ...rpcResult };
  const from = vi.fn((table: string) => {
    const chain = chains[table];
    if (!chain) throw new Error(`unexpected table: ${table}`);
    return chain;
  });
  const rpc = vi.fn(async () => resolvedRpc);
  const client = { from, rpc } as unknown as SupabaseClient;
  return { client, from, rpc };
}

describe('loadWorkout', () => {
  it('returns null when no plan is scheduled for the date', async () => {
    const plansChain = makeChain({ data: null });
    const { client, from } = makeClient({ plans: plansChain });

    const result = await loadWorkout(client, '2026-07-14');

    expect(result).toBeNull();
    expect(from).toHaveBeenCalledWith('plans');
    expect(from).not.toHaveBeenCalledWith('workout_executions');
  });

  it('returns null and never queries executions when plan_data fails schema validation', async () => {
    const plansChain = makeChain({ data: { id: 'plan-1', plan_data: { kind: 'gym_workout' } } });
    const { client, from } = makeClient({ plans: plansChain });

    const result = await loadWorkout(client, '2026-07-14');

    expect(result).toBeNull();
    expect(from).not.toHaveBeenCalledWith('workout_executions');
  });

  it('loads a valid plan and its in-progress execution with the expected query shape', async () => {
    const plansChain = makeChain({ data: { id: 'plan-1', plan_data: plan } });
    const executionsChain = makeChain({ data: execution });
    const { client } = makeClient({ plans: plansChain, workout_executions: executionsChain });

    const result = await loadWorkout(client, '2026-07-14');

    expect(result).toEqual({ plan, planId: 'plan-1', execution });
    expect(plansChain.eq).toHaveBeenCalledWith('scheduled_for', '2026-07-14');
    expect(plansChain.eq).toHaveBeenCalledWith('plan_data->>kind', 'gym_workout');
    expect(plansChain.is).toHaveBeenCalledWith('deleted_at', null);
    expect(executionsChain.eq).toHaveBeenCalledWith('plan_id', 'plan-1');
  });

  it('loads a valid plan with no execution yet', async () => {
    const plansChain = makeChain({ data: { id: 'plan-1', plan_data: plan } });
    const executionsChain = makeChain({ data: null });
    const { client } = makeClient({ plans: plansChain, workout_executions: executionsChain });

    const result = await loadWorkout(client, '2026-07-14');

    expect(result).toEqual({ plan, planId: 'plan-1', execution: null });
  });

  it("throws a user-facing error when the plans query fails", async () => {
    const plansChain = makeChain({ error: { message: 'db unreachable' } });
    const { client } = makeClient({ plans: plansChain });

    await expect(loadWorkout(client, '2026-07-14')).rejects.toThrow(/could not load today's workout/i);
    await expect(loadWorkout(client, '2026-07-14')).rejects.toThrow(/db unreachable/);
  });

  it('throws a user-facing error when the executions query fails', async () => {
    const plansChain = makeChain({ data: { id: 'plan-1', plan_data: plan } });
    const executionsChain = makeChain({ error: { message: 'rls denied' } });
    const { client } = makeClient({ plans: plansChain, workout_executions: executionsChain });

    await expect(loadWorkout(client, '2026-07-14')).rejects.toThrow(/load workout progress/i);
  });
});

describe('startWorkout', () => {
  it('inserts only the fields the client is allowed to control', async () => {
    const executionsChain = makeChain({ data: execution });
    const { client } = makeClient({ workout_executions: executionsChain });

    const data = executionFromPlan(plan);
    const result = await startWorkout(client, 'user-1', 'plan-1', plan, data);

    expect(result).toEqual(execution);
    const insertPayload = executionsChain.insert.mock.calls[0][0];
    expect(insertPayload).toEqual({
      user_id: 'user-1',
      plan_id: 'plan-1',
      scheduled_for: plan.scheduled_for,
      planned_snapshot: plan,
      execution_data: data,
    });
    expect(insertPayload).not.toHaveProperty('status');
    expect(insertPayload).not.toHaveProperty('provenance');
    expect(insertPayload).not.toHaveProperty('completed_at');
  });

  it('throws a user-facing error on insert failure', async () => {
    const executionsChain = makeChain({ error: { message: 'unique violation' } });
    const { client } = makeClient({ workout_executions: executionsChain });

    await expect(startWorkout(client, 'user-1', 'plan-1', plan, executionFromPlan(plan))).rejects.toThrow(/start this workout/i);
  });

  it('accepts execution data carrying user-added exercises and sets', async () => {
    const base = executionFromPlan(plan);
    const withUserAdditions = {
      ...base,
      exercises: [
        ...base.exercises,
        {
          client_id: 'added-1',
          name: 'Lunges',
          user_added: true,
          sets: [{ reps: 8, weight_kg: null, rest_seconds: 90, completed: false, user_added: true }],
        },
      ],
    };

    expect(() => workoutExecutionDataSchema.parse(withUserAdditions)).not.toThrow();

    const executionsChain = makeChain({ data: { ...execution, execution_data: withUserAdditions } });
    const { client } = makeClient({ workout_executions: executionsChain });
    const result = await startWorkout(client, 'user-1', 'plan-1', plan, withUserAdditions);

    expect(result.execution_data.exercises).toHaveLength(2);
    expect(result.execution_data.exercises[1]).toMatchObject({ user_added: true, name: 'Lunges' });
  });
});

describe('saveWorkout', () => {
  it('updates execution_data and additional_notes only, scoped by id', async () => {
    const executionsChain = makeChain({});
    const { client } = makeClient({ workout_executions: executionsChain });

    const data = executionFromPlan(plan);
    await saveWorkout(client, 'exec-1', data, 'felt strong today');

    expect(executionsChain.update).toHaveBeenCalledWith({ execution_data: data, additional_notes: 'felt strong today' });
    expect(executionsChain.eq).toHaveBeenCalledWith('id', 'exec-1');
  });

  it('throws a user-facing error on update failure', async () => {
    const executionsChain = makeChain({ error: { message: 'rls denied' } });
    const { client } = makeClient({ workout_executions: executionsChain });

    await expect(saveWorkout(client, 'exec-1', executionFromPlan(plan), '')).rejects.toThrow(/save workout progress/i);
  });
});

describe('completeWorkout', () => {
  it('calls the completion RPC with the execution id', async () => {
    const { client, rpc } = makeClient({}, { data: { id: 'exec-1' } });

    await completeWorkout(client, 'exec-1');

    expect(rpc).toHaveBeenCalledWith('complete_gym_workout_execution', { p_execution_id: 'exec-1' });
  });

  it('throws a user-facing error when the RPC rejects', async () => {
    const { client } = makeClient({}, { error: { message: 'already completed' } });

    await expect(completeWorkout(client, 'exec-1')).rejects.toThrow(/finish this workout/i);
    await expect(completeWorkout(client, 'exec-1')).rejects.toThrow(/already completed/);
  });
});
