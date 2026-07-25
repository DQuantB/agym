import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import { grantHermesAuthorization } from '../authorizationApi';

describe('grantHermesAuthorization', () => {
  it('writes only the signed-in owner, fixed Hermes identity, requested action, and versioned scope', async () => {
    let inserted: unknown;
    const client = {
      from: () => ({
        insert: async (value: unknown) => {
          inserted = value;
          return { error: null };
        },
      }),
    } as unknown as SupabaseClient;

    await grantHermesAuthorization(client, '11111111-1111-4111-8111-111111111111', 'read_context');

    expect(inserted).toEqual({
      user_id: '11111111-1111-4111-8111-111111111111',
      agent_identifier: 'hermes',
      action: 'read_context',
      scope: { version: 1 },
    });
  });

  it('reports a safe action-specific error when the authorization insert fails', async () => {
    const client = {
      from: () => ({
        insert: async () => ({ error: { message: 'permission denied' } }),
      }),
    } as unknown as SupabaseClient;

    await expect(grantHermesAuthorization(client, '11111111-1111-4111-8111-111111111111', 'write_proposed_plan'))
      .rejects.toThrow('AGYM could not grant Hermes permission: permission denied');
  });
});
