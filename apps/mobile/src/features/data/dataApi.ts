import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type { SupabaseClient } from '@supabase/supabase-js';

import { clearAccountLocalExecutionDrafts } from '@/features/workout/localDraftStore';

import { deleteAccountAndClearLocalData } from './accountDeletion';
import { serializeMobileDataExport } from './mobileDataExport';

export type Authorization = {
  id: string;
  agent: string;
  action: string;
  scope: unknown;
  grantedAt: string;
  revokedAt: string | null;
};

export async function loadAuthorizations(client: SupabaseClient): Promise<Authorization[]> {
  const { data, error } = await client
    .from('agent_authorizations')
    .select('id, agent_identifier, action, scope, granted_at, revoked_at')
    .order('granted_at', { ascending: false });

  if (error) throw new Error(`AGYM could not load model permissions: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id,
    agent: row.agent_identifier,
    action: row.action,
    scope: row.scope,
    grantedAt: row.granted_at,
    revokedAt: row.revoked_at,
  }));
}

export async function revokeAuthorization(client: SupabaseClient, id: string) {
  const { error } = await client
    .from('agent_authorizations')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .is('revoked_at', null);

  if (error) throw new Error(`AGYM could not revoke this permission: ${error.message}`);
}

export async function writeMobileDataExport(client: SupabaseClient): Promise<void> {
  const [rawLogs, canonicalEvents] = await Promise.all([
    client
      .from('raw_logs')
      .select('client_id, raw_text, logged_for_date, created_at')
      .is('deleted_at', null)
      .order('created_at', { ascending: true }),
    client
      .from('canonical_events')
      .select('client_id, final_fields, confirmed_at')
      .is('deleted_at', null)
      .order('confirmed_at', { ascending: true }),
  ]);

  if (rawLogs.error) throw new Error(`AGYM could not export raw self-reports: ${rawLogs.error.message}`);
  if (canonicalEvents.error) throw new Error(`AGYM could not export confirmed outcomes: ${canonicalEvents.error.message}`);

  const content = serializeMobileDataExport(rawLogs.data ?? [], canonicalEvents.data ?? []);
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('AGYM could not open the system export sheet on this device.');
  }

  const filename = `agym-export-${new Date().toISOString().slice(0, 10)}.json`;
  const uri = `${FileSystem.documentDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, content, { encoding: FileSystem.EncodingType.UTF8 });
  await Sharing.shareAsync(uri, { dialogTitle: 'Save or share your AGYM JSON export', mimeType: 'application/json' });
}

export async function deleteAccount(
  client: SupabaseClient,
  userId: string,
  signOut: () => Promise<void>,
): Promise<void> {
  await deleteAccountAndClearLocalData(userId, {
    deleteRemoteAccount: async () => {
      const { error } = await client.rpc('delete_my_account');
      if (error) throw new Error(`AGYM could not delete your account: ${error.message}`);
    },
    clearLocalDrafts: clearAccountLocalExecutionDrafts,
    signOut,
  });
}
