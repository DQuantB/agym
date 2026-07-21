import { describe, expect, it } from 'vitest';

import { mapTodayState } from './todayState';

const activePlan = { id: '11111111-1111-4111-8111-111111111111', title: 'Lower strength', scheduledFor: '2026-07-21' };
const proposal = { id: '22222222-2222-4222-8222-222222222222', title: 'Agent lower strength', scheduledFor: '2026-07-21' };
const base = { configured: true, authenticated: true, activePlan: null, execution: null, proposal: null };

describe('mapTodayState', () => {
  it('keeps unconfigured and signed-out devices out of data states', () => {
    expect(mapTodayState({ ...base, configured: false })).toEqual({ kind: 'unconfigured' });
    expect(mapTodayState({ ...base, authenticated: false })).toEqual({ kind: 'signed_out' });
  });

  it('shows loading before a configured session resolves', () => {
    expect(mapTodayState({ ...base, authenticated: false, loading: true })).toEqual({ kind: 'loading' });
  });

  it('maps no active plan to no_session', () => {
    expect(mapTodayState(base)).toEqual({ kind: 'no_session', proposal: null });
  });

  it('maps a proposed plan alone to proposal_waiting, never ready', () => {
    const state = mapTodayState({ ...base, proposal });
    expect(state).toEqual({ kind: 'proposal_waiting', proposal });
    expect(state.kind).not.toBe('ready');
  });

  it('maps an accepted active plan without an execution to ready', () => {
    expect(mapTodayState({ ...base, activePlan })).toEqual({ kind: 'ready', plan: activePlan, proposal: null });
  });

  it('maps only an active plan execution to in_progress or confirmed', () => {
    expect(mapTodayState({ ...base, activePlan, execution: { id: 'exec-1', status: 'in_progress', completedAt: null } })).toMatchObject({ kind: 'in_progress', plan: activePlan });
    expect(mapTodayState({ ...base, activePlan, execution: { id: 'exec-2', status: 'completed', completedAt: '2026-07-21T10:00:00Z' } })).toMatchObject({ kind: 'confirmed', plan: activePlan });
  });

  it('keeps a separately loaded proposal as a banner adjunct to an active plan', () => {
    expect(mapTodayState({ ...base, activePlan, proposal })).toEqual({ kind: 'ready', plan: activePlan, proposal });
  });
});
