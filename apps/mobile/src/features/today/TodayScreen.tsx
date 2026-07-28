import { Button, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import { useAuth } from '@/auth/AuthProvider';
import { Screen, StatusCard } from '@/components/Screen';
import { getSupabaseClient } from '@/lib/supabase';
import { colors, spacing } from '@/theme/tokens';

import { addCalendarDays, buildHomeCalendarDays, weekStart } from './homeSchedule';
import { loadTodayRemoteData, loadUpcomingActivePlans, type TodayRemoteData } from './todayApi';
import { mapTodayState, type TodayPlan, type TodayState } from './todayState';

function todayLocalDate(date = new Date()): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function stateCard(state: TodayState) {
  switch (state.kind) {
    case 'unconfigured': return <StatusCard title="Connections are not configured" detail="This device has no public AGYM data connection yet." />;
    case 'signed_out': return <StatusCard title="Sign in required" detail="Sign in to view your owner-scoped training context." />;
    case 'loading': return <StatusCard title="Loading home" detail="Checking accepted training and saved workout progress." />;
    case 'error': return <StatusCard tone="warning" title="Could not load home" detail={state.message} />;
    case 'no_session': return <StatusCard title="No workout today" detail="No accepted Gym workout is scheduled for today." />;
    case 'proposal_waiting': return <StatusCard tone="proposal" title="✧ Agent proposal" detail={`${state.proposal.title}. Review-only training cannot be started.`} />;
    case 'ready': return <StatusCard title="◇ Today's workout" detail={`${state.plan.title} is accepted and ready to record.`} />;
    case 'in_progress': return <StatusCard tone="proposal" title="● Workout in progress" detail={`${state.plan.title}. Your saved actual workout progress can be resumed.`} />;
    case 'confirmed': return <StatusCard tone="confirmed" title="✓ User confirmed" detail={`${state.plan.title}. This completed outcome is available in your history.`} />;
  }
}

export function TodayScreen() {
  const router = useRouter();
  const auth = useAuth();
  const date = useMemo(() => todayLocalDate(), []);
  const calendarThroughDate = useMemo(() => addCalendarDays(date, 90), [date]);
  const [remote, setRemote] = useState<TodayRemoteData | null>(null);
  const [upcomingPlans, setUpcomingPlans] = useState<TodayPlan[]>([]);
  const [selectedDate, setSelectedDate] = useState(date);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useFocusEffect(useCallback(() => {
    if (!auth.ready || !auth.configured || !auth.session) return undefined;
    const client = getSupabaseClient();
    if (!client) return undefined;
    let active = true;
    setLoading(true);
    setError(null);
    void Promise.all([
      loadTodayRemoteData(client, date),
      loadUpcomingActivePlans(client, date, calendarThroughDate),
    ])
      .then(([today, upcoming]) => { if (active) { setRemote(today); setUpcomingPlans(upcoming); } })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Unknown data error.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [auth.configured, auth.ready, auth.session, calendarThroughDate, date]));

  const state = mapTodayState({
    configured: auth.configured,
    authenticated: Boolean(auth.session),
    loading: !auth.ready || loading,
    error,
    activePlan: remote?.activePlan ?? null,
    execution: remote?.execution ?? null,
    proposal: remote?.proposal ?? null,
  });
  const proposal = 'proposal' in state ? state.proposal : null;
  const days = buildHomeCalendarDays(weekStart(selectedDate), 7, upcomingPlans);
  const selectedPlan = days.find((day) => day.date === selectedDate)?.plan ?? null;
  const selectedCalendarDate = new Date(`${selectedDate}T12:00:00.000Z`);
  const month = selectedCalendarDate.toLocaleDateString(undefined, { month: 'long', timeZone: 'UTC' });
  const plannedInWeek = days.filter((day) => day.plan).length;

  return (
    <Screen
      eyebrow={`AGYM · HOME · ${date}`} title="Home"
      action={<Pressable accessibilityRole="button" accessibilityLabel="Log something" onPress={() => router.push('/capture' as never)}><Text style={styles.actionText}>+ Log something</Text></Pressable>}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {proposal && state.kind !== 'proposal_waiting' ? <StatusCard tone="proposal" title="✧ Agent proposal" detail={`${proposal.title}. Nothing has been applied yet — review it in Plans before it can become scheduled training.`} /> : null}
        <View style={styles.calendarCard}>
          <View style={styles.calendarHeader}><Text style={styles.monthLabel}>{month}</Text><Text style={styles.eventCount}>{plannedInWeek} planned</Text></View>
          <View style={styles.weekNavigation}>
            <Pressable accessibilityRole="button" accessibilityLabel="Previous day" hitSlop={8} onPress={() => setSelectedDate((value) => addCalendarDays(value, -1))} style={styles.dayArrow}><Text style={styles.dayArrowText}>‹</Text></Pressable>
            <View style={styles.calendarGrid}>
              {days.map((day) => {
                const selected = day.date === selectedDate;
                return <Pressable key={day.date} accessibilityRole="button" accessibilityLabel={`${day.weekday} ${day.date}${day.plan ? `: ${day.plan.title}` : ': no scheduled workout'}`} onPress={() => setSelectedDate(day.date)} style={styles.day}>
                  <Text style={styles.weekday}>{day.weekday}</Text><View style={[styles.dayNumberWrap, selected ? styles.daySelected : null]}><Text style={[styles.dayNumber, selected ? styles.dayNumberSelected : null]}>{day.dayOfMonth}</Text></View><View style={[styles.dot, day.plan ? styles.dotWithPlan : null]} />
                </Pressable>;
              })}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Next day" hitSlop={8} onPress={() => setSelectedDate((value) => addCalendarDays(value, 1))} style={styles.dayArrow}><Text style={styles.dayArrowText}>›</Text></Pressable>
          </View>
          {selectedPlan ? <View style={styles.selectedPlan}><Text style={styles.selectedLabel}>{selectedDate === date ? 'TODAY' : `SCHEDULED · ${selectedDate}`}</Text><Text style={styles.selectedTitle}>{selectedPlan.title}</Text><Text style={styles.selectedDetail}>{selectedDate === date ? 'This accepted workout can be started below.' : selectedDate > date ? 'Review or adjust this future workout before its scheduled day.' : 'This workout is in the past and cannot be changed.'}</Text>{selectedDate > date ? <Button title="View & edit workout" color={colors.orange} accessibilityLabel={`View and edit future workout ${selectedPlan.title}`} onPress={() => router.push({ pathname: '/workout', params: { mode: 'edit', planId: selectedPlan.id } } as never)} /> : null}</View> : <Text style={styles.noPlan}>No accepted training is scheduled for {selectedDate}.</Text>}
        </View>
        {stateCard(state)}
        {state.kind === 'ready' ? <Button title="Start workout" color={colors.orange} accessibilityLabel="Start accepted planned workout" onPress={() => router.push('/workout' as never)} /> : null}
        {state.kind === 'in_progress' ? <Button title="Resume workout" color={colors.orange} accessibilityLabel="Resume saved workout" onPress={() => router.push('/workout' as never)} /> : null}
        {state.kind === 'no_session' ? <Button title="Log an unplanned workout" accessibilityLabel="Log an unplanned workout" onPress={() => router.push('/capture' as never)} /> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  actionText: { color: colors.orange, fontSize: 13, fontWeight: '700' },
  calendarCard: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 20, gap: spacing.sm, padding: spacing.md },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  monthLabel: { color: colors.text, fontSize: 20, fontWeight: '700' },
  eventCount: { color: colors.muted, fontSize: 14, fontWeight: '700' },
  weekNavigation: { alignItems: 'center', flexDirection: 'row' },
  dayArrow: { alignItems: 'center', justifyContent: 'center', minHeight: 76, width: 20 },
  dayArrowText: { color: colors.text, fontSize: 28, lineHeight: 32 },
  calendarGrid: { flex: 1, flexDirection: 'row', justifyContent: 'space-between' },
  day: { alignItems: 'center', flex: 1, gap: 4, minHeight: 76 },
  weekday: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  dayNumberWrap: { alignItems: 'center', borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  daySelected: { backgroundColor: colors.text },
  dayNumber: { color: colors.text, fontSize: 18, fontWeight: '700' },
  dayNumberSelected: { color: colors.background },
  dot: { backgroundColor: 'transparent', borderRadius: 3, height: 6, width: 6 },
  dotWithPlan: { backgroundColor: colors.orange },
  selectedPlan: { backgroundColor: colors.background, borderRadius: 10, gap: spacing.xs, padding: spacing.sm },
  selectedLabel: { color: colors.orange, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  selectedTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  selectedDetail: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  noPlan: { color: colors.muted, fontSize: 13 },
});
