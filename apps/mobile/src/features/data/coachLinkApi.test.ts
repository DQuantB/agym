import type { SupabaseClient } from '@supabase/supabase-js';
import { expect, it, vi } from 'vitest';

import { loadMyCoachLink, redeemCoachCode, unlinkCoach } from './coachLinkApi';

it('loads the active coach link with the coach display name', async () => {
  const result = { data: { id: 'link-1', linked_at: '2026-08-04T10:00:00Z', coach_profiles: { display_name: 'Coach One' } }, error: null };
  const query: Record<string, ReturnType<typeof vi.fn>> & PromiseLike<typeof result> = {} as never;
  for (const method of ['select', 'eq']) query[method] = vi.fn(() => query);
  query.maybeSingle = vi.fn(() => Promise.resolve(result));
  const from = vi.fn(() => query);

  const link = await loadMyCoachLink({ from } as unknown as SupabaseClient);

  expect(query.eq).toHaveBeenCalledWith('status', 'active');
  expect(link).toEqual({ id: 'link-1', coachName: 'Coach One', linkedAt: '2026-08-04T10:00:00Z' });
});

it('returns null when the client has no active coach link', async () => {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ['select', 'eq']) query[method] = vi.fn(() => query);
  query.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
  const from = vi.fn(() => query);

  expect(await loadMyCoachLink({ from } as unknown as SupabaseClient)).toBeNull();
});

it('redeems a coach code through the RPC and surfaces the linked coach', async () => {
  const rpc = vi.fn().mockResolvedValue({ data: { linkId: 'link-1', coachName: 'Coach One', linkedAt: '2026-08-04T10:00:00Z' }, error: null });

  const link = await redeemCoachCode({ rpc } as unknown as SupabaseClient, ' abc123 ');

  expect(rpc).toHaveBeenCalledWith('redeem_coach_code', { p_code: 'abc123' });
  expect(link).toEqual({ id: 'link-1', coachName: 'Coach One', linkedAt: '2026-08-04T10:00:00Z' });
});

it('surfaces the RPC error message when a code cannot be redeemed', async () => {
  const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'this coach code is invalid, expired, or no longer available' } });

  await expect(redeemCoachCode({ rpc } as unknown as SupabaseClient, 'BADCODE')).rejects.toThrow(
    'this coach code is invalid, expired, or no longer available',
  );
});

it('unlinks a coach through the revoke RPC', async () => {
  const rpc = vi.fn().mockResolvedValue({ error: null });
  await unlinkCoach({ rpc } as unknown as SupabaseClient, 'link-1');
  expect(rpc).toHaveBeenCalledWith('revoke_coach_link', { p_link_id: 'link-1' });
});
