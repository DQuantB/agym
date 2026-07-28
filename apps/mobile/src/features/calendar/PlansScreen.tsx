import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { Screen, StatusCard } from '@/components/Screen';
import { getSupabaseClient } from '@/lib/supabase';
import { formatWeekdayDate } from '@/lib/dateLabels';
import { colors, radius, spacing } from '@/theme/tokens';

import { loadCalendarPlans, type CalendarPlan } from './calendarApi';
import { mapCalendarScreenState } from './calendarState';
import { buildPlanAgenda } from './planAgenda';

function todayLocalDate(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export function PlansScreen() {
  const auth = useAuth();
  const router = useRouter();
  const [proposals, setProposals] = useState<CalendarPlan[]>([]);
  const [scheduled, setScheduled] = useState<CalendarPlan[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pastExpanded, setPastExpanded] = useState(false);

  useFocusEffect(useCallback(() => {
    if (!auth.ready || !auth.configured || !auth.session) { setLoading(false); return undefined; }
    const client = getSupabaseClient();
    if (!client) { setMessage('This device has no public AGYM data connection yet.'); return undefined; }
    let active = true;
    setLoading(true);
    setMessage(null);
    void loadCalendarPlans(client)
      .then((result) => { if (active) { setProposals(result.proposals); setScheduled(result.scheduled); } })
      .catch((error: unknown) => { if (active) setMessage(error instanceof Error ? error.message : 'Could not load calendar plans.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [auth.configured, auth.ready, auth.session]));

  const state = mapCalendarScreenState({
    configured: auth.configured, authenticated: Boolean(auth.session), loading: !auth.ready || loading,
    error: message, proposals, scheduled,
  });

  if (state.kind === 'unconfigured') return <Screen eyebrow="PLANS" title="Agenda"><StatusCard title="Connections are not configured" detail="Add the public AGYM connection before loading your plans." /></Screen>;
  if (state.kind === 'signed_out') return <Screen eyebrow="PLANS" title="Agenda"><StatusCard title="Sign in required" detail="Sign in to view your owner-scoped plans." /></Screen>;
  if (state.kind === 'loading') return <Screen eyebrow="PLANS" title="Agenda"><StatusCard title="Loading plans" detail="Checking your agent proposals and accepted training." /></Screen>;
  if (state.kind === 'error') return <Screen eyebrow="PLANS" title="Agenda"><StatusCard tone="warning" title="Plans unavailable" detail={state.message} /></Screen>;

  const today = todayLocalDate();
  const agenda = buildPlanAgenda({ proposals: state.proposals, scheduled: state.scheduled, today });
  const upcoming = [...agenda.today, ...agenda.upcoming];

  return (
    <Screen eyebrow="PLANS" title="Agenda">
      <ScrollView contentContainerStyle={styles.list}>
        {agenda.proposals.length ? (
          <>
            <Text style={styles.sectionHeader}>✧ NEEDS YOUR REVIEW ({agenda.proposals.length})</Text>
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
                <Pressable accessibilityRole="button" accessibilityLabel={`Start ${entry.title}`} style={styles.primaryButton} onPress={() => router.push('/workout' as never)}>
                  <Text style={styles.primaryButtonText}>START WORKOUT</Text>
                </Pressable>
              ) : (
                <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${entry.title}`} style={styles.secondaryButton} onPress={() => router.push({ pathname: '/workout', params: { mode: 'edit', planId: entry.id } } as never)}>
                  <Text style={styles.secondaryButtonText}>Edit</Text>
                </Pressable>
              )}
            </View>
          </View>
        )) : <StatusCard title="No scheduled sessions" detail="Only accepted plans can become scheduled training." />}

        {agenda.past.length ? (
          <>
            <Pressable accessibilityRole="button" accessibilityLabel={pastExpanded ? 'Hide past scheduled sessions' : 'Show past scheduled sessions'} style={styles.disclosure} onPress={() => setPastExpanded((value) => !value)}>
              <Text style={styles.disclosureText}>{pastExpanded ? '▾' : '▸'} Past scheduled ({agenda.past.length})</Text>
            </Pressable>
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
  primaryButton: { alignItems: 'center', backgroundColor: colors.orange, borderRadius: radius.md, justifyContent: 'center', marginTop: spacing.xs, minHeight: 44 },
  primaryButtonText: { color: colors.background, fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  secondaryButton: { alignItems: 'center', alignSelf: 'flex-start', borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, justifyContent: 'center', marginTop: spacing.xs, minHeight: 44, paddingHorizontal: spacing.md },
  secondaryButtonText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  disclosure: { justifyContent: 'center', marginTop: spacing.sm, minHeight: 44 },
  disclosureText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
});
