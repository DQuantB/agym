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
import { grantHermesAuthorization, type AuthorizationAction } from '@/features/data/authorizationApi';
import { getSupabaseClient } from '@/lib/supabase';
import { colors } from '@/theme/tokens';

const hermesPermissions: { action: AuthorizationAction; title: string; detail: string; confirm: string }[] = [
  {
    action: 'read_context',
    title: 'Allow Hermes to read bounded context',
    detail: 'Hermes may read bounded immutable raw self-reports and confirmed outcomes when you ask it to help. Raw self-reports remain unparsed evidence.',
    confirm: 'Allow Hermes to read your bounded AGYM context?',
  },
  {
    action: 'write_proposed_plan',
    title: 'Allow Hermes to write proposed plans',
    detail: 'Hermes may save review-required workout proposals. It cannot confirm outcomes or activate instructions for you.',
    confirm: 'Allow Hermes to save review-required AGYM plan proposals?',
  },
];

export default function DataScreen() {
  const auth = useAuth();
  const [grants, setGrants] = useState<Authorization[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [pendingAction, setPendingAction] = useState<AuthorizationAction | null>(null);

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

  const grant = (permission: typeof hermesPermissions[number]) => {
    const client = getSupabaseClient();
    const userId = auth.session?.user.id;
    if (!client || !userId) return;

    Alert.alert('Allow Hermes permission?', permission.confirm, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Allow',
        onPress: () => {
          setPendingAction(permission.action);
          setMessage(null);
          void grantHermesAuthorization(client, userId, permission.action)
            .then(() => {
              setMessage('Hermes permission granted. It takes effect on the next MCP call.');
              refresh();
            })
            .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Could not grant Hermes permission.'))
            .finally(() => setPendingAction(null));
        },
      },
    ]);
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

  const activeHermesGrant = (action: AuthorizationAction) => grants.find((grant) => grant.agent === 'hermes' && grant.action === action && !grant.revokedAt);

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
      {hermesPermissions.map((permission) => {
        const authorization = activeHermesGrant(permission.action);
        return (
          <View key={permission.action}>
            <StatusCard title={permission.title} detail={permission.detail} />
            {authorization
              ? <Button title={`Revoke Hermes ${permission.action}`} onPress={() => Alert.alert('Revoke permission?', `Stop Hermes from ${permission.action}.`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Revoke', style: 'destructive', onPress: () => revoke(authorization.id) },
              ])} />
              : <Button title={pendingAction === permission.action ? 'Saving permission…' : permission.title} disabled={pendingAction !== null} onPress={() => grant(permission)} />}
          </View>
        );
      })}
      <ScrollView>
        {grants.filter((grant) => !grant.revokedAt && grant.agent !== 'hermes').map((grant) => (
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
