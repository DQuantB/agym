import { useEffect, useState } from 'react';
import { Alert, Button, ScrollView, Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { Screen, StatusCard } from '@/components/Screen';
import {
  deleteAccount,
  loadAuthorizations,
  revokeAuthorization,
  type Authorization,
  writeMobileDataExport,
} from '@/features/data/dataApi';
import { getSupabaseClient } from '@/lib/supabase';
import { colors } from '@/theme/tokens';

export default function DataScreen() {
  const auth = useAuth();
  const [grants, setGrants] = useState<Authorization[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const refresh = () => {
    const client = getSupabaseClient();
    if (!client || !auth.session) return;

    void loadAuthorizations(client)
      .then(setGrants)
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Could not load permissions.'));
  };

  useEffect(refresh, [auth.session]);

  const revoke = (id: string) => {
    const client = getSupabaseClient();
    if (!client) return;

    void revokeAuthorization(client, id)
      .then(refresh)
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Could not revoke permission.'));
  };

  const exportData = () => {
    const client = getSupabaseClient();
    if (!client) return;

    setExporting(true);
    setMessage(null);
    void writeMobileDataExport(client)
      .then(() => setMessage('Your JSON export is ready in the system save/share sheet.'))
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'AGYM could not create your export.'))
      .finally(() => setExporting(false));
  };

  const erase = () => {
    const client = getSupabaseClient();
    const userId = auth.session?.user.id;
    if (!client || !userId) return;

    setMessage(null);
    void deleteAccount(client, userId, auth.signOut)
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Could not delete your account.'));
  };

  return (
    <Screen eyebrow="DATA" title="Your data layer">
      <Button title="Sign out" onPress={() => void auth.signOut()} />
      {message ? <StatusCard tone="warning" title="Data action" detail={message} /> : null}
      <StatusCard
        title="Sources in"
        detail="No device imports are connected in this mobile alpha. Workout evidence comes from your confirmed AGYM sessions."
      />
      <Button title={exporting ? 'Preparing JSON export…' : 'Export my JSON data'} disabled={exporting} onPress={exportData} />
      <Text style={{ color: colors.text, fontWeight: '700' }}>READERS OUT</Text>
      <ScrollView>
        {grants.filter((grant) => !grant.revokedAt).map((grant) => (
          <View key={grant.id}>
            <StatusCard
              title={`${grant.agent} · MCP active`}
              detail={`Allowed: ${grant.action}. Granted ${new Date(grant.grantedAt).toLocaleDateString()}.`}
            />
            <Button
              title="Revoke access"
              onPress={() => Alert.alert('Revoke permission?', `Stop ${grant.agent} from ${grant.action}.`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Revoke', style: 'destructive', onPress: () => revoke(grant.id) },
              ])}
            />
          </View>
        ))}
      </ScrollView>
      {!grants.some((grant) => !grant.revokedAt) ? (
        <StatusCard title="No active model readers" detail="AGYM will list only live, owner-controlled authorizations here." />
      ) : null}
      <Button
        title="Delete account + data"
        color={colors.orange}
        onPress={() => Alert.alert(
          'Delete account and all data?',
          'This removes your hosted AGYM account and its data, then clears local workout drafts. This cannot be undone.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete everything', style: 'destructive', onPress: erase },
          ],
        )}
      />
    </Screen>
  );
}
