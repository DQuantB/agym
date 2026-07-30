import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { Screen, StatusCard } from '@/components/Screen';
import { getSupabaseClient } from '@/lib/supabase';
import { colors, spacing } from '@/theme/tokens';

import { grantAgentAuthorization, type AuthorizationAction, type AuthorizationAgent } from './authorizationApi';
import {
  deleteAccount,
  loadAuthorizations,
  revokeAuthorization,
  type Authorization,
  writeMobileDataExport,
} from './dataApi';

type AgentScope = {
  agent: AuthorizationAgent;
  action: AuthorizationAction;
  title: string;
  detail: string;
  confirm: string;
};

type AgentSection = {
  agent: AuthorizationAgent;
  label: string;
  scopes: AgentScope[];
};

const AGENT_SECTIONS: AgentSection[] = [
  {
    agent: 'hermes',
    label: 'Hermes',
    scopes: [
      {
        agent: 'hermes', action: 'read_context',
        title: 'Read bounded context',
        detail: 'Hermes may read bounded immutable raw self-reports and confirmed outcomes when you ask it to help. Raw self-reports remain unparsed evidence.',
        confirm: 'Allow Hermes to read your bounded AGYM context?',
      },
      {
        agent: 'hermes', action: 'write_proposed_plan',
        title: 'Write proposed plans',
        detail: 'Hermes may save review-required workout proposals. It cannot confirm outcomes or activate instructions for you.',
        confirm: 'Allow Hermes to save review-required AGYM plan proposals?',
      },
    ],
  },
  {
    agent: 'remote-mcp',
    label: 'Remote MCP client',
    scopes: [
      {
        agent: 'remote-mcp', action: 'read_context',
        title: 'Read bounded context',
        detail: 'A remote MCP client you connect through AGYM OAuth may read bounded raw self-reports and confirmed outcomes. OAuth sign-in alone does not grant this access.',
        confirm: 'Allow your connected remote MCP client to read bounded AGYM context?',
      },
      {
        agent: 'remote-mcp', action: 'write_proposed_plan',
        title: 'Write proposed plans',
        detail: 'A remote MCP client you connect through AGYM OAuth may save review-required workout proposals. It cannot confirm outcomes or activate instructions for you.',
        confirm: 'Allow your connected remote MCP client to save review-required AGYM plan proposals?',
      },
    ],
  },
];

type Status = { tone: 'warning' | 'confirmed'; text: string } | null;

export function DataScreen() {
  const auth = useAuth();
  const [grants, setGrants] = useState<Authorization[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<Status>(null);
  const [exportStatus, setExportStatus] = useState<Status>(null);
  const [accountStatus, setAccountStatus] = useState<Status>(null);
  const [exporting, setExporting] = useState(false);
  const [pendingPermission, setPendingPermission] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    const client = getSupabaseClient();
    if (!client || !auth.session) return undefined;
    let active = true;
    setLoading(true);
    setLoadError(null);
    void loadAuthorizations(client)
      .then((rows) => { if (active) setGrants(rows); })
      .catch((cause: unknown) => { if (active) setLoadError(cause instanceof Error ? cause.message : 'Could not load permissions.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [auth.session]));

  const refreshGrants = () => {
    const client = getSupabaseClient();
    if (!client || !auth.session) return;
    void loadAuthorizations(client)
      .then(setGrants)
      .catch((error: unknown) => setPermissionStatus({ tone: 'warning', text: error instanceof Error ? error.message : 'Could not load permissions.' }));
  };

  const revoke = (id: string, label: string) => {
    const client = getSupabaseClient();
    if (!client) return;

    void revokeAuthorization(client, id)
      .then(() => {
        setPermissionStatus({ tone: 'confirmed', text: `${label} permission revoked.` });
        refreshGrants();
      })
      .catch((error: unknown) => setPermissionStatus({ tone: 'warning', text: error instanceof Error ? error.message : 'Could not revoke permission.' }));
  };

  const confirmRevoke = (id: string, agentLabel: string, action: string) => Alert.alert('Revoke permission?', `Stop ${agentLabel} from ${action}.`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Revoke', style: 'destructive', onPress: () => revoke(id, agentLabel) },
  ]);

  const grant = (agentLabel: string, scope: AgentScope) => {
    const client = getSupabaseClient();
    const userId = auth.session?.user.id;
    if (!client || !userId) return;

    Alert.alert(`Allow ${agentLabel} permission?`, scope.confirm, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Allow',
        onPress: () => {
          const key = `${scope.agent}:${scope.action}`;
          setPendingPermission(key);
          setPermissionStatus(null);
          void grantAgentAuthorization(client, userId, scope.agent, scope.action)
            .then(() => {
              setPermissionStatus({ tone: 'confirmed', text: `${agentLabel} permission granted. It takes effect on the next MCP call.` });
              refreshGrants();
            })
            .catch((error: unknown) => setPermissionStatus({ tone: 'warning', text: error instanceof Error ? error.message : `Could not grant ${agentLabel} permission.` }))
            .finally(() => setPendingPermission(null));
        },
      },
    ]);
  };

  const exportData = () => {
    const client = getSupabaseClient();
    if (!client) return;

    setExporting(true);
    setExportStatus(null);
    void writeMobileDataExport(client)
      .then(() => setExportStatus({ tone: 'confirmed', text: 'Your JSON export is ready in the system save/share sheet.' }))
      .catch((error: unknown) => setExportStatus({ tone: 'warning', text: error instanceof Error ? error.message : 'AGYM could not create your export.' }))
      .finally(() => setExporting(false));
  };

  const erase = () => {
    const client = getSupabaseClient();
    const userId = auth.session?.user.id;
    if (!client || !userId) return;

    setAccountStatus(null);
    void deleteAccount(client, userId, auth.signOut)
      .catch((error: unknown) => setAccountStatus({ tone: 'warning', text: error instanceof Error ? error.message : 'Could not delete your account.' }));
  };

  const activeGrant = (agent: AuthorizationAgent, action: AuthorizationAction) => grants.find(
    (candidate) => candidate.agent === agent && candidate.action === action && !candidate.revokedAt,
  );

  if (!auth.configured) return <Screen eyebrow="DATA" title="Your data layer"><StatusCard title="Connections are not configured" detail="Add the public AGYM connection before managing your data and permissions." /></Screen>;
  if (!auth.session) return <Screen eyebrow="DATA" title="Your data layer"><StatusCard title="Sign in required" detail="Sign in to manage your owner-scoped data and permissions." /></Screen>;

  const otherGrants = grants.filter((candidate) => !candidate.revokedAt && candidate.agent !== 'hermes' && candidate.agent !== 'remote-mcp');
  const hasActiveGrant = grants.some((candidate) => !candidate.revokedAt);

  return (
    <Screen eyebrow="DATA" title="Your data layer">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionHeader}>SOURCES IN</Text>
        <StatusCard
          title="Connected sources"
          detail="No device imports are connected in this mobile alpha. Workout evidence comes from your confirmed AGYM sessions."
        />

        <Text style={styles.sectionHeader}>MODEL ACCESS</Text>
        {loadError ? <StatusCard tone="warning" title="Permissions unavailable" detail={loadError} /> : null}
        {permissionStatus ? <StatusCard tone={permissionStatus.tone} title="Permission update" detail={permissionStatus.text} /> : null}
        {loading && !grants.length ? <StatusCard title="Loading permissions" detail="Checking your connected sources and model access." /> : null}

        {AGENT_SECTIONS.map((section) => (
          <View key={section.agent} style={styles.agentGroup}>
            <Text style={styles.agentLabel}>{section.label}</Text>
            {section.scopes.map((scope) => {
              const authorization = activeGrant(scope.agent, scope.action);
              const key = `${scope.agent}:${scope.action}`;
              return (
                <View key={key} style={styles.scopeRow}>
                  <StatusCard title={scope.title} detail={scope.detail} />
                  {authorization ? (
                    <Button
                      label="Revoke" variant="destructive"
                      accessibilityLabel={`Revoke ${section.label} ${scope.action}`}
                      onPress={() => confirmRevoke(authorization.id, section.label, scope.action)}
                    />
                  ) : (
                    <Button
                      label="Allow" variant="secondary"
                      busy={pendingPermission === key}
                      disabled={pendingPermission !== null}
                      accessibilityLabel={`Allow ${section.label} to ${scope.title.toLowerCase()}`}
                      onPress={() => grant(section.label, scope)}
                    />
                  )}
                </View>
              );
            })}
          </View>
        ))}

        {otherGrants.length ? (
          <View style={styles.agentGroup}>
            <Text style={styles.agentLabel}>Other connected agents</Text>
            {otherGrants.map((candidate) => (
              <View key={candidate.id} style={styles.scopeRow}>
                <StatusCard
                  title={`${candidate.agent} · MCP active`}
                  detail={`Allowed: ${candidate.action}. Granted ${new Date(candidate.grantedAt).toLocaleDateString()}.`}
                />
                <Button
                  label="Revoke" variant="destructive"
                  accessibilityLabel={`Revoke ${candidate.agent} ${candidate.action}`}
                  onPress={() => confirmRevoke(candidate.id, candidate.agent, candidate.action)}
                />
              </View>
            ))}
          </View>
        ) : null}

        {!loading && !hasActiveGrant ? (
          <StatusCard title="No active model readers" detail="AGYM will list only live, owner-controlled authorizations here." />
        ) : null}

        <Text style={styles.sectionHeader}>ACCOUNT</Text>
        {exportStatus ? <StatusCard tone={exportStatus.tone} title="Export" detail={exportStatus.text} /> : null}
        <Button
          label="Export my JSON data" variant="secondary" fullWidth
          busy={exporting} accessibilityLabel={exporting ? 'Preparing JSON export' : 'Export my JSON data'}
          onPress={exportData}
        />

        {accountStatus ? <StatusCard tone={accountStatus.tone} title="Account" detail={accountStatus.text} /> : null}
        <Button
          label="Delete account + data" variant="danger" fullWidth
          accessibilityLabel="Delete account and all data"
          onPress={() => Alert.alert(
            'Delete account and all data?',
            'This removes your hosted AGYM account and its data, then clears local workout drafts. This cannot be undone.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete everything', style: 'destructive', onPress: erase },
            ],
          )}
        />

        <Button label="Sign out" variant="tertiary" fullWidth onPress={() => void auth.signOut()} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  sectionHeader: { color: colors.muted, fontSize: 12, fontWeight: '800', letterSpacing: 1, marginTop: spacing.md },
  agentGroup: { gap: spacing.sm },
  agentLabel: { color: colors.text, fontSize: 15, fontWeight: '700' },
  scopeRow: { gap: spacing.xs },
});
