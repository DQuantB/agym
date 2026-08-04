import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { DisclosureRow } from '@/components/DisclosureRow';
import { Screen, StatusCard } from '@/components/Screen';
import { getSupabaseClient } from '@/lib/supabase';
import { formatWeekdayDate } from '@/lib/dateLabels';
import { colors, radius, spacing } from '@/theme/tokens';

import { acceptCalendarProposals, loadCalendarPlans, loadSupersededPlansByDate, restoreSupersededPlan, type CalendarPlan, type SupersededPlan } from './calendarApi';
import { mapCalendarScreenState } from './calendarState';
import { buildPlanAgenda, formatProposalBatchConfirmation, summarizeBulkAcceptResults, type AgendaEntry } from './planAgenda';

function todayLocalDate(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export function PlansScreen() {
  const auth = useAuth();
  const router = useRouter();
  const [proposals, setProposals] = useState<CalendarPlan[]>([]);
  const [scheduled, setScheduled] = useState<CalendarPlan[]>([]);
  const [supersededByDate, setSupersededByDate] = useState<Map<string, SupersededPlan>>(new Map());
  const [message, setMessage] = useState<string | null>(null);
  const [restoreStatus, setRestoreStatus] = useState<{ tone: 'warning' | 'confirmed'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [pastExpanded, setPastExpanded] = useState(false);
  const [bulkAccepting, setBulkAccepting] = useState(false);
  const [bulkAcceptStatus, setBulkAcceptStatus] = useState<{ tone: 'warning' | 'confirmed'; text: string } | null>(null);

  const refresh = useCallback(async () => {
    const client = getSupabaseClient();
    if (!client) { setMessage('This device has no public AGYM data connection yet.'); return; }
    setLoading(true);
    setMessage(null);
    try {
      const [plans, superseded] = await Promise.all([loadCalendarPlans(client), loadSupersededPlansByDate(client)]);
      setProposals(plans.proposals);
      setScheduled(plans.scheduled);
      setSupersededByDate(superseded);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load calendar plans.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    if (!auth.ready || !auth.configured || !auth.session) { setLoading(false); return undefined; }
    let active = true;
    void refresh().then(() => { if (!active) return; });
    return () => { active = false; };
  }, [auth.configured, auth.ready, auth.session, refresh]));

  function goBackToPrevious(entry: { id: string; title: string; previousPlan?: SupersededPlan }) {
    if (!entry.previousPlan) return;
    const previous = entry.previousPlan;
    Alert.alert(
      `Go back to "${previous.title}"?`,
      `This replaces "${entry.title}" with your previous plan for that day. Nothing is deleted — either plan can be restored again later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Go back', onPress: () => {
            const client = getSupabaseClient();
            if (!client) return;
            setRestoringId(previous.id);
            setRestoreStatus(null);
            void restoreSupersededPlan(client, previous.id)
              .then(({ restoredTitle }) => { setRestoreStatus({ tone: 'confirmed', text: `Restored "${restoredTitle}".` }); return refresh(); })
              .catch((error: unknown) => setRestoreStatus({ tone: 'warning', text: error instanceof Error ? error.message : 'Could not restore this plan.' }))
              .finally(() => setRestoringId(null));
          },
        },
      ],
    );
  }

  function acceptAll(entries: AgendaEntry[]) {
    const client = getSupabaseClient();
    if (!client || bulkAccepting || entries.length === 0) return;
    Alert.alert(
      `Accept all ${entries.length} proposals?`,
      `${formatProposalBatchConfirmation(entries)}\n\nEach becomes planned training. Any day that already has an accepted plan keeps the previous one in your history and can be restored.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Accept all ${entries.length}`, onPress: () => {
            setBulkAccepting(true);
            setBulkAcceptStatus(null);
            void acceptCalendarProposals(client, entries.map((entry) => entry.id))
              .then(async (results) => {
                const { acceptedCount, failed } = summarizeBulkAcceptResults(results, entries);
                setBulkAcceptStatus(failed.length
                  ? { tone: 'warning', text: `${acceptedCount} of ${entries.length} accepted. Could not accept: ${failed.map((item) => `${item.title} (${item.error})`).join('; ')}.` }
                  : { tone: 'confirmed', text: `Accepted all ${acceptedCount} proposals.` });
                await refresh();
              })
              .catch((error: unknown) => setBulkAcceptStatus({ tone: 'warning', text: error instanceof Error ? error.message : 'Could not accept these proposals.' }))
              .finally(() => setBulkAccepting(false));
          },
        },
      ],
    );
  }

  const state = mapCalendarScreenState({
    configured: auth.configured, authenticated: Boolean(auth.session), loading: !auth.ready || loading,
    error: message, proposals, scheduled,
  });

  if (state.kind === 'unconfigured') return <Screen eyebrow="PLANS" title="Agenda"><StatusCard title="Connections are not configured" detail="Add the public AGYM connection before loading your plans." /></Screen>;
  if (state.kind === 'signed_out') return <Screen eyebrow="PLANS" title="Agenda"><StatusCard title="Sign in required" detail="Sign in to view your owner-scoped plans." /></Screen>;
  if (state.kind === 'loading') return <Screen eyebrow="PLANS" title="Agenda"><StatusCard title="Loading plans" detail="Checking your agent proposals and accepted training." /></Screen>;
  if (state.kind === 'error') return <Screen eyebrow="PLANS" title="Agenda"><StatusCard tone="warning" title="Plans unavailable" detail={state.message} /></Screen>;

  const today = todayLocalDate();
  const agenda = buildPlanAgenda({ proposals: state.proposals, scheduled: state.scheduled, today, supersededByDate });
  const upcoming = [...agenda.today, ...agenda.upcoming];

  return (
    <Screen eyebrow="PLANS" title="Agenda">
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {restoreStatus ? <StatusCard tone={restoreStatus.tone} title="Previous plan" detail={restoreStatus.text} /> : null}
        {agenda.proposals.length ? (
          <>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeader}>✧ NEEDS YOUR REVIEW ({agenda.proposals.length})</Text>
              {agenda.proposals.length > 1 ? (
                <Button
                  label={`Accept all ${agenda.proposals.length}`} variant="primary" busy={bulkAccepting}
                  accessibilityLabel={`Accept all ${agenda.proposals.length} proposals`}
                  onPress={() => acceptAll(agenda.proposals)}
                />
              ) : null}
            </View>
            {bulkAcceptStatus ? <StatusCard tone={bulkAcceptStatus.tone} title="Accept all" detail={bulkAcceptStatus.text} /> : null}
            {agenda.proposals.map((entry) => (
              <Pressable
                key={entry.id} accessibilityRole="button" accessibilityLabel={`Review agent proposal. ${entry.accessibilityLabel}`}
                style={styles.proposalCard} onPress={() => router.push({ pathname: '/proposal', params: { id: entry.id } } as never)}
              >
                <Text style={styles.proposalEyebrow}>✧ AGENT PROPOSAL · {entry.source} · {formatWeekdayDate(entry.scheduledFor)}</Text>
                <Text style={styles.title}>{entry.title}</Text>
                <Text style={styles.detail}>for {entry.whenLabel} · {entry.exerciseCount} exercises · {entry.setCount} sets</Text>
                <Text style={styles.summary}>{entry.summary}</Text>
                <Text style={styles.detail}>Nothing has been applied yet.</Text>
                <View style={styles.reviewButton}><Text style={styles.reviewButtonText}>REVIEW</Text></View>
              </Pressable>
            ))}
          </>
        ) : <StatusCard tone="proposal" title="No proposal waiting" detail="Agent-authored plans will appear here for your deliberate review." />}

        <Text style={styles.sectionHeader}>◇ SCHEDULED</Text>
        {upcoming.length ? upcoming.map((entry) => (
          <View key={entry.id} style={styles.scheduledRow}>
            <View style={styles.dayChip}><Text style={styles.dayChipWeekday}>{entry.dayChip.weekday}</Text><Text style={styles.dayChipNumber}>{entry.dayChip.dayOfMonth}</Text></View>
            <View style={styles.scheduledBody}>
              <Text style={styles.detail}>◇ Planned · {entry.whenLabel}</Text>
              <Text style={styles.title}>{entry.title}</Text>
              <Text style={styles.detail}>{entry.exerciseCount} exercises · {entry.setCount} sets</Text>
              {entry.bucket === 'today' ? (
                <Button label="START WORKOUT" variant="primary" fullWidth accessibilityLabel={`Start ${entry.title}`} onPress={() => router.push('/workout' as never)} />
              ) : (
                <Button label="Edit" variant="secondary" accessibilityLabel={`Edit ${entry.title}`} onPress={() => router.push({ pathname: '/workout', params: { mode: 'edit', planId: entry.id } } as never)} />
              )}
              {entry.previousPlan ? (
                <Button
                  label={`↺ Go back to "${entry.previousPlan.title}"`} variant="tertiary"
                  busy={restoringId === entry.previousPlan.id} disabled={restoringId !== null}
                  accessibilityLabel={`Go back to previous plan "${entry.previousPlan.title}" for ${entry.whenLabel}`}
                  onPress={() => goBackToPrevious(entry)}
                />
              ) : null}
            </View>
          </View>
        )) : <StatusCard title="No scheduled sessions" detail="Only accepted plans can become scheduled training." />}

        {agenda.past.length ? (
          <>
            <DisclosureRow
              label={`Past scheduled (${agenda.past.length})`}
              expanded={pastExpanded}
              onToggle={() => setPastExpanded((value) => !value)}
              accessibilityLabel={pastExpanded ? 'Hide past scheduled sessions' : 'Show past scheduled sessions'}
            />
            {pastExpanded ? agenda.past.map((entry) => (
              <View key={entry.id} style={styles.scheduledRow}>
                <View style={styles.dayChip}><Text style={styles.dayChipWeekday}>{entry.dayChip.weekday}</Text><Text style={styles.dayChipNumber}>{entry.dayChip.dayOfMonth}</Text></View>
                <View style={styles.scheduledBody}>
                  <Text style={styles.detail}>◇ Planned · not performed</Text>
                  <Text style={styles.title}>{entry.title}</Text>
                  <Text style={styles.detail}>{entry.exerciseCount} exercises · {entry.setCount} sets</Text>
                </View>
              </View>
            )) : null}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm, paddingBottom: spacing.xl },
  sectionHeaderRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  sectionHeader: { color: colors.muted, fontSize: 12, fontWeight: '800', letterSpacing: 1, marginTop: spacing.md },
  proposalCard: { backgroundColor: colors.surface, borderColor: colors.orange, borderRadius: radius.lg, borderWidth: 1, gap: spacing.xs, padding: spacing.md },
  proposalEyebrow: { color: colors.orange, fontSize: 12, fontWeight: '800' },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  detail: { color: colors.muted, lineHeight: 20 },
  summary: { color: colors.muted, fontSize: 13, fontStyle: 'italic' },
  reviewButton: { alignItems: 'center', backgroundColor: colors.orange, borderRadius: radius.md, justifyContent: 'center', marginTop: spacing.xs, minHeight: 48 },
  reviewButtonText: { color: colors.background, fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
  scheduledRow: { flexDirection: 'row', gap: spacing.sm },
  dayChip: { alignItems: 'center', backgroundColor: colors.surfaceRaised, borderRadius: radius.md, gap: 2, paddingVertical: spacing.sm, width: 52 },
  dayChipWeekday: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  dayChipNumber: { color: colors.text, fontSize: 20, fontWeight: '700' },
  scheduledBody: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, borderWidth: 1, flex: 1, gap: spacing.xs, padding: spacing.md },
});
