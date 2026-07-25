import type { SupabaseClient } from '@supabase/supabase-js';

export type AuthorizationAction = 'read_context' | 'write_proposed_plan';
export type AuthorizationAgent = 'hermes' | 'remote-mcp';

export async function grantAgentAuthorization(
  client: SupabaseClient,
  userId: string,
  agentIdentifier: AuthorizationAgent,
  action: AuthorizationAction,
) {
  const { error } = await client
    .from('agent_authorizations')
    .insert({
      user_id: userId,
      agent_identifier: agentIdentifier,
      action,
      scope: { version: 1 },
    });

  if (error) throw new Error(`AGYM could not grant ${agentIdentifier} permission: ${error.message}`);
}

export function grantHermesAuthorization(client: SupabaseClient, userId: string, action: AuthorizationAction) {
  return grantAgentAuthorization(client, userId, 'hermes', action);
}

export function grantRemoteMcpAuthorization(client: SupabaseClient, userId: string, action: AuthorizationAction) {
  return grantAgentAuthorization(client, userId, 'remote-mcp', action);
}
