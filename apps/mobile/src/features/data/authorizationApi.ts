import type { SupabaseClient } from '@supabase/supabase-js';

export type AuthorizationAction = 'read_context' | 'write_proposed_plan';

export async function grantHermesAuthorization(
  client: SupabaseClient,
  userId: string,
  action: AuthorizationAction,
) {
  const { error } = await client
    .from('agent_authorizations')
    .insert({
      user_id: userId,
      agent_identifier: 'hermes',
      action,
      scope: { version: 1 },
    });

  if (error) throw new Error(`AGYM could not grant Hermes permission: ${error.message}`);
}
