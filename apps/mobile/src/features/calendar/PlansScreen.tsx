import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { DisclosureRow } from '@/components/DisclosureRow';
import { Screen, StatusCard } from '@/components/Screen';
import { resolveCacheFreshness } from '@/lib/cacheFreshness';
import { formatWeekdayDate } from '@/lib/dateLabels';
import { readCacheRow, writeCacheRow } from '@/lib/localCache';
import { getSupabaseClient } from '@/lib/supabase';
import { colors, hit, radius, spacing } from '@/theme/tokens';

import { acceptCalendarProposals, findActivePlanConflicts, loadCalendarPlans, loadSupersededPlansByDate, restoreSupersededPlan, type CalendarPlan, type SupersededPlan } from './calendarApi';
import { mapCalendarScreenState } from './calendarState';
import { buildPlanAgenda, formatProposalBatchConfirmation, summarizeBulkAcceptResults, type ProposalGroup } from './planAgenda';
import { parsePlansCache, resolvePlansView, serializePlansCache, type ParsedPlansCache } from './plansCache';

const PLANS_CACHE_KEY = 'plans';

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
  const [acceptingGroup, setAcceptingGroup] = useState<string | null>(null);
  const [bulkAccepting, setBulkAccepting] = useState(false);
  const [bulkAcceptStatus, setBulkAcceptStatus] = useState<{ tone: 'warning' | 'confirmed'; text: string } | null>(null);
  const [cache, setCache] = useState<{ payload: ParsedPlansCache; updatedAt: string } | null>(null);
  const [cacheChecked, setCacheChecked] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);
  // Sticky, unlike `message` which resets the instant a retry starts — keeps
  // the stale-data warning card + Retry button visible through a retry
  // attempt instead of it vanishing the moment it's tapped.
  const [lastRefreshFailed, setLastRefreshFailed] = useState(false);
  const userId = auth.session?.user.id ?? null;

  // Runs once per session (not per focus) — read is what makes the screen
  // render instantly from disk before any network round trip completes.
  useEffect(() => {
    if (!userId) { setCache(null); setCacheChecked(true); return undefined; }
    let active = true;
    setCacheChecked(false);
    void readCacheRow(userId, PLANS_CACHE_KEY).then((row) => {
      if (!active) return;
      const parsed = row ? parsePlansCache(row.payload) : null;
      setCache(parsed ? { payload: parsed, updatedAt: row!.updatedAt } : null);
      setCacheChecked(true);
    });
    return () => { active = false; };
  }, [userId]);

  const refresh = useCallback(async () => {
    const client = getSupabaseClient();
    if (!client) { setMessage('This device has no public AGYM data connection yet.'); setLastRefreshFailed(true); return; }
    setLoading(true);
    setMessage(null);
    try {
      const [plans, superseded] = await Promise.all([loadCalendarPlans(client), loadSupersededPlansByDate(client)]);
      setProposals(plans.proposals);
      setScheduled(plans.scheduled);
      setSupersededByDate(superseded);
      setRefreshedAt(new Date().toISOString());
      setLastRefreshFailed(false);
      if (userId) void writeCacheRow(userId, PLANS_CACHE_KEY, serializePlansCache({ ...plans, supersededByDate: superseded })).catch(() => undefined);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load calendar plans.');
      setLastRefreshFailed(true);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(useCallback(() => {
    if (!auth.ready || !auth.configured || !auth.session) { setLoading(false); return undefined; }
    let active = true;
    void refresh().then(() => { if (!active) return; });
    return () => { active = false; };
  }, [auth.configured, auth.ready, auth.session, refresh]));

  async function acceptGroup(group: ProposalGroup) {
    const client = getSupabaseClient();
    if (!client || acceptingGroup) return;
    setAcceptingGroup(group.key);
    const dates = group.occurrences.map((occurrence) => occurrence.scheduledFor);
    const conflicts = await findActivePlanConflicts(client, group.entry.kind, dates).catch(() => []);
    const count = group.occurrences.length;
    const conflictNote = conflicts.length
      ? ` This replaces ${conflicts.length} existing accepted ${group.entry.categoryLabel} session${conflicts.length === 1 ? '' : 's'} already on your calendar.`
      : '';
    Alert.alert(
      `Accept all ${count} sessions?`,
      `"${group.entry.title}" repeats identically on ${count} days.${conflictNote} Accepting adds every occurrence to your calendar as planned training.`,
      [{ text: 'Cancel', style: 'cancel', onPress: () => setAcceptingGroup(null) }, {
        text: conflicts.length ? `Replace ${conflicts.length} and accept all ${count}` : `Accept all ${count}`,
        onPress: () => {
          void acceptCalendarProposals(client, group.occurrences.map((occurrence) => occurrence.id))
            .then((results) => {
              refresh();
              const { failed } = summarizeBulkAcceptResults(results, group.occurrences.map((occurrence) => ({ id: occurrence.id, title: group.entry.title })));
              if (failed.length) Alert.alert('Some sessions could not be accepted', failed.map((failure) => `${failure.title}: ${failure.error}`).join('\n'));
            })
            .catch((error: unknown) => Alert.alert('Could not accept these sessions', error instanceof Error ? error.message : 'Unknown error.'))
            .finally(() => setAcceptingGroup(null));
        },
      }],
    );
  }

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

  function acceptAllGroups(groups: ProposalGroup[]) {
    const client = getSupabaseClient();
    const entries = groups.flatMap((group) => group.occurrences.map((occurrence) => ({ id: occurrence.id, title: group.entry.title, whenLabel: occurrence.whenLabel })));
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

  const hasCache = cache !== null;
  const refreshed = refreshedAt !== null;
  const viewProposals = resolvePlansView({ refreshed, live: proposals, cached: cache?.payload.proposals ?? null });
  const viewScheduled = resolvePlansView({ refreshed, live: scheduled, cached: cache?.payload.scheduled ?? null });
  const viewSupersededByDate = resolvePlansView({ refreshed, live: supersededByDate, cached: cache?.payload.supersededByDate ?? null });
  const freshness = resolveCacheFreshness({
    cacheUpdatedAt: cache?.updatedAt ?? null,
    refreshSucceeded: refreshed,
    refreshFailed: lastRefreshFailed,
    now: new Date(),
  });

  const state = mapCalendarScreenState({
    configured: auth.configured, authenticated: Boolean(auth.session), loading: (!auth.ready || !cacheChecked || loading) && !hasCache,
    error: hasCache ? null : message, proposals: viewProposals, scheduled: viewScheduled,
  });

  if (state.kind === 'unconfigured') return <Screen eyebrow="PLANS" title="Agenda"><StatusCard title="Connections are not configured" detail="Add the public AGYM connection before loading your plans." /></Screen>;
  if (state.kind === 'signed_out') return <Screen eyebrow="PLANS" title="Agenda"><StatusCard title="Sign in required" detail="Sign in to view your owner-scoped plans." /></Screen>;
  if (state.kind === 'loading') return <Screen eyebrow="PLANS" title="Agenda"><StatusCard busy title="Loading plans" detail="Checking your agent proposals and accepted training." /></Screen>;
  if (state.kind === 'error') return <Screen eyebrow="PLANS" title="Agenda"><StatusCard tone="warning" title="Plans unavailable" detail={state.message} /></Screen>;

  const today = todayLocalDate();
  const agenda = buildPlanAgenda({ proposals: state.proposals, scheduled: state.scheduled, today, supersededByDate: viewSupersededByDate });
  const upcoming = [...agenda.today, ...agenda.upcoming];
  const totalProposalCount = agenda.proposals.reduce((sum, group) => sum + group.occurrences.length, 0);

  return (
    <Screen
      eyebrow="PLANS" title="Agenda"
      action={<Button label="+ Create workout" variant="tertiary" accessibilityLabel="Create a workout without an agent" onPress={() => router.push({ pathname: '/workout', params: { mode: 'create' } } as never)} />}
    >
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {freshness.kind === 'stale' ? <Text style={styles.staleLine}>Saved data · updated {freshness.label}</Text> : null}
        {freshness.kind === 'stale_failed' ? (
          <>
            <StatusCard tone="warning" title="Showing saved data" detail={`Couldn't refresh. Last updated ${freshness.label}.`} />
            <Button label="Retry" variant="secondary" fullWidth busy={loading} accessibilityLabel="Retry loading plans" onPress={() => void refresh()} />
          </>
        ) : null}
        {restoreStatus ? <StatusCard tone={restoreStatus.tone} title="Previous plan" detail={restoreStatus.text} /> : null}
        {agenda.proposals.length ? (
          <>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeader}>✧ NEEDS YOUR REVIEW ({totalProposalCount})</Text>
              {totalProposalCount > 1 ? (
                <Button
                  label={`Accept all ${totalProposalCount}`} variant="primary" busy={bulkAccepting}
                  accessibilityLabel={`Accept all ${totalProposalCount} proposals`}
                  onPress={() => acceptAllGroups(agenda.proposals)}
                />
              ) : null}
            </View>
            {bulkAcceptStatus ? <StatusCard tone={bulkAcceptStatus.tone} title="Accept all" detail={bulkAcceptStatus.text} /> : null}
            {agenda.proposals.map((group) => {
              const { entry, occurrences } = group;
              const repeats = occurrences.length > 1;
              return (
                <View key={group.key} style={styles.proposalCard}>
                  <Pressable
                    accessibilityRole="button" accessibilityLabel={`Review agent proposal. ${entry.accessibilityLabel}${repeats ? ` Repeats on ${occurrences.length} days.` : ''}`}
                    onPress={() => router.push({ pathname: '/proposal', params: { id: entry.id } } as never)}
                  >
                    <Text style={styles.proposalEyebrow}>✧ AGENT PROPOSAL · {entry.source}{repeats ? ` · ${occurrences.length} DAYS` : ` · ${formatWeekdayDate(entry.scheduledFor)}`}</Text>
                    <Text style={styles.title}>{entry.title}</Text>
                    <Text style={styles.detail}>
                      {repeats ? `Repeats ${occurrences.map((occurrence) => occurrence.whenLabel).join(', ')}` : `for ${entry.whenLabel}`} · {entry.exerciseCount} exercises · {entry.setCount} sets
                    </Text>
                    <Text style={styles.summary}>{entry.summary}</Text>
                    <Text style={styles.detail}>Nothing has been applied yet.</Text>
                  </Pressable>
                  {repeats ? (
                    <View style={styles.proposalActions}>
                      <Pressable accessibilityRole="button" accessibilityLabel={`Review one occurrence of ${entry.title}`} style={styles.secondaryButton} onPress={() => router.push({ pathname: '/proposal', params: { id: entry.id } } as never)}>
                        <Text style={styles.secondaryButtonText}>Review one</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button" accessibilityLabel={`Accept all ${occurrences.length} sessions of ${entry.title}`}
                        disabled={acceptingGroup === group.key} style={[styles.reviewButton, styles.groupAcceptButton]} onPress={() => void acceptGroup(group)}
                      >
                        <Text style={styles.reviewButtonText}>{acceptingGroup === group.key ? 'ACCEPTING…' : `ACCEPT ALL ${occurrences.length}`}</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable accessibilityRole="button" accessibilityLabel={`Review ${entry.title}`} style={styles.reviewButton} onPress={() => router.push({ pathname: '/proposal', params: { id: entry.id } } as never)}>
                      <Text style={styles.reviewButtonText}>REVIEW</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
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
  list: { gap: spacing.sm, paddingBottom: spacing.xl + hit.primary },
  staleLine: { color: colors.muted, fontSize: 12 },
  sectionHeaderRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  sectionHeader: { color: colors.muted, fontSize: 12, fontWeight: '800', letterSpacing: 1, marginTop: spacing.md },
  proposalCard: { backgroundColor: colors.surface, borderColor: colors.orange, borderRadius: radius.lg, borderWidth: 1, gap: spacing.xs, padding: spacing.md },
  proposalEyebrow: { color: colors.orange, fontSize: 12, fontWeight: '800' },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  detail: { color: colors.muted, lineHeight: 20 },
  summary: { color: colors.muted, fontSize: 13, fontStyle: 'italic' },
  reviewButton: { alignItems: 'center', backgroundColor: colors.orange, borderRadius: radius.md, justifyContent: 'center', marginTop: spacing.xs, minHeight: 48 },
  reviewButtonText: { color: colors.background, fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
  proposalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  secondaryButton: { alignItems: 'center', borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, justifyContent: 'center', minHeight: 48, paddingHorizontal: spacing.md },
  secondaryButtonText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  groupAcceptButton: { flex: 1, marginTop: 0 },
  scheduledRow: { flexDirection: 'row', gap: spacing.sm },
  dayChip: { alignItems: 'center', backgroundColor: colors.surfaceRaised, borderRadius: radius.md, gap: 2, paddingVertical: spacing.sm, width: 52 },
  dayChipWeekday: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  dayChipNumber: { color: colors.text, fontSize: 20, fontWeight: '700' },
  scheduledBody: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, borderWidth: 1, flex: 1, gap: spacing.xs, padding: spacing.md },
});
