import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import { generateCoachCode, loadClientEvents, loadClientPlans, loadMyClients, loadMyCoachCodes, loadMyCoachProfile } from './coachApi';

function selectQuery(result: unknown) {
  const query: Record<string, ReturnType<typeof vi.fn>> & PromiseLike<unknown> = {} as never;
  for (const method of ['select', 'eq', 'order', 'limit']) query[method] = vi.fn(() => query);
  query.maybeSingle = vi.fn(() => Promise.resolve(result));
  query.then = (resolve) => Promise.resolve(result).then(resolve);
  return query;
}

describe('coachApi', () => {
  it('loads the coach profile for the signed-in coach', async () => {
    const from = vi.fn(() => selectQuery({ data: { user_id: 'coach-1', display_name: 'Coach One' }, error: null }));
    const profile = await loadMyCoachProfile({ from } as unknown as SupabaseClient);
    expect(profile).toEqual({ userId: 'coach-1', displayName: 'Coach One' });
  });

  it('returns null when the signed-in account has no coach profile', async () => {
    const from = vi.fn(() => selectQuery({ data: null, error: null }));
    expect(await loadMyCoachProfile({ from } as unknown as SupabaseClient)).toBeNull();
  });

  it('loads coach codes ordered newest first', async () => {
    const rows = [{ id: 'c1', code: 'ABC123', requires_payment: false, use_count: 2, max_uses: null, active: true }];
    const from = vi.fn(() => selectQuery({ data: rows, error: null }));
    const codes = await loadMyCoachCodes({ from } as unknown as SupabaseClient);
    expect(codes).toEqual([{ id: 'c1', code: 'ABC123', requiresPayment: false, useCount: 2, maxUses: null, active: true }]);
  });

  it('generates a coach code through the RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: 'c2', code: 'XYZ789', requires_payment: false, use_count: 0, max_uses: null, active: true }, error: null });
    const code = await generateCoachCode({ rpc } as unknown as SupabaseClient);
    expect(rpc).toHaveBeenCalledWith('generate_coach_code');
    expect(code.code).toBe('XYZ789');
  });

  it('loads the client roster with display names', async () => {
    const rows = [{ id: 'link-1', client_id: 'client-1', linked_at: '2026-08-04T10:00:00Z', profiles: { display_name: 'Jane' } }];
    const from = vi.fn(() => selectQuery({ data: rows, error: null }));
    const clients = await loadMyClients({ from } as unknown as SupabaseClient);
    expect(clients).toEqual([{ linkId: 'link-1', clientId: 'client-1', displayName: 'Jane', linkedAt: '2026-08-04T10:00:00Z' }]);
  });

  it("loads a client's accepted plans", async () => {
    const rows = [{ id: 'p1', plan_data: { title: 'Upper body' }, status: 'active', scheduled_for: '2026-08-05', created_at: '2026-08-01T00:00:00Z' }];
    const from = vi.fn(() => selectQuery({ data: rows, error: null }));
    const plans = await loadClientPlans({ from } as unknown as SupabaseClient, 'client-1');
    expect(plans).toEqual([{ id: 'p1', title: 'Upper body', status: 'active', scheduledFor: '2026-08-05', createdAt: '2026-08-01T00:00:00Z' }]);
  });

  it("loads a client's confirmed events", async () => {
    const rows = [{ id: 'e1', event_type: 'workout', final_fields: {}, confirmed_at: '2026-08-02T00:00:00Z' }];
    const from = vi.fn(() => selectQuery({ data: rows, error: null }));
    const events = await loadClientEvents({ from } as unknown as SupabaseClient, 'client-1');
    expect(events).toEqual([{ id: 'e1', eventType: 'workout', finalFields: {}, confirmedAt: '2026-08-02T00:00:00Z' }]);
  });
});
