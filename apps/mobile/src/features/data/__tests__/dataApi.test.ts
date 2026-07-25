import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import { grantHermesAuthorization, grantRemoteMcpAuthorization } from '../authorizationApi';

const userId = '11111111-1111-4111-8111-111111111111';

describe('agent permission grants', () => {
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

    await grantHermesAuthorization(client, userId, 'read_context');

    expect(inserted).toEqual({
      user_id: userId,
      agent_identifier: 'hermes',
      action: 'read_context',
      scope: { version: 1 },
    });
  });

  it('writes only the signed-in owner, fixed remote-MCP identity, requested action, and versioned scope', async () => {
    let inserted: unknown;
    const client = {
      from: () => ({
        insert: async (value: unknown) => {
          inserted = value;
          return { error: null };
        },
      }),
    } as unknown as SupabaseClient;

    await grantRemoteMcpAuthorization(client, userId, 'write_proposed_plan');

    expect(inserted).toEqual({
      user_id: userId,
      agent_identifier: 'remote-mcp',
      action: 'write_proposed_plan',
      scope: { version: 1 },
    });
  });

  it('reports a safe Hermes-specific error when the authorization insert fails', async () => {
    const client = {
      from: () => ({
        insert: async () => ({ error: { message: 'permission denied' } }),
      }),
    } as unknown as SupabaseClient;

    await expect(grantHermesAuthorization(client, userId, 'write_proposed_plan'))
      .rejects.toThrow('AGYM could not grant hermes permission: permission denied');
  });

  it('reports a safe remote-specific error when the authorization insert fails', async () => {
    const client = {
      from: () => ({
        insert: async () => ({ error: { message: 'permission denied' } }),
      }),
    } as unknown as SupabaseClient;

    await expect(grantRemoteMcpAuthorization(client, userId, 'read_context'))
      .rejects.toThrow('AGYM could not grant remote-mcp permission: permission denied');
  });
});
