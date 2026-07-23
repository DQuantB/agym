export type TodayPlan = { id: string; title: string; scheduledFor: string };
export type TodayExecution = { id: string; status: 'in_progress' | 'completed'; completedAt: string | null };

export type TodayState =
  | { kind: 'unconfigured' }
  | { kind: 'signed_out' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'no_session'; proposal: TodayPlan | null }
  | { kind: 'proposal_waiting'; proposal: TodayPlan }
  | { kind: 'ready'; plan: TodayPlan; proposal: TodayPlan | null }
  | { kind: 'in_progress'; plan: TodayPlan; execution: TodayExecution; proposal: TodayPlan | null }
  | { kind: 'confirmed'; plan: TodayPlan; execution: TodayExecution; proposal: TodayPlan | null };

type Input = {
  configured: boolean;
  authenticated: boolean;
  loading?: boolean;
  error?: string | null;
  activePlan: TodayPlan | null;
  execution: TodayExecution | null;
  proposal: TodayPlan | null;
};

export function mapTodayState(input: Input): TodayState {
  if (!input.configured) return { kind: 'unconfigured' };
  if (input.loading) return { kind: 'loading' };
  if (!input.authenticated) return { kind: 'signed_out' };
  if (input.error) return { kind: 'error', message: input.error };

  // An agent proposal is never an active baseline. It cannot reach ready or
  // execution states without a separately loaded, accepted active plan.
  if (!input.activePlan) {
    if (input.proposal) return { kind: 'proposal_waiting', proposal: input.proposal };
    return { kind: 'no_session', proposal: null };
  }
  if (!input.execution) return { kind: 'ready', plan: input.activePlan, proposal: input.proposal };
  if (input.execution.status === 'in_progress') {
    return { kind: 'in_progress', plan: input.activePlan, execution: input.execution, proposal: input.proposal };
  }
  return { kind: 'confirmed', plan: input.activePlan, execution: input.execution, proposal: input.proposal };
}
