import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { DisclosureRow } from '@/components/DisclosureRow';
import { Screen, StatusCard } from '@/components/Screen';
import { getSupabaseClient } from '@/lib/supabase';
import { formatWeekdayDate } from '@/lib/dateLabels';
import { colors, radius, spacing } from '@/theme/tokens';

import type { ConfirmedWorkout } from './confirmedWorkout';
import { computeExercisePrs } from './exercisePrs';
import { loadCompletedWorkouts, loadEvidenceHistory, type EvidenceHistoryItem } from './logApi';
import { historyTotals, toSessionCard } from './sessionSummary';
import { TrainingDensityGrid } from './TrainingDensityGrid';

export function HistoryScreen() {
  const auth = useAuth();
  const router = useRouter();
  const [workouts, setWorkouts] = useState<ConfirmedWorkout[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [evidenceExpanded, setEvidenceExpanded] = useState(false);
  const [evidence, setEvidence] = useState<EvidenceHistoryItem[] | null>(null);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [prsExpanded, setPrsExpanded] = useState(false);

  useFocusEffect(useCallback(() => {
    const client = getSupabaseClient();
    if (!client || !auth.session) return undefined;
    let active = true;
    setLoading(true);
    setError(null);
    void loadCompletedWorkouts(client)
      .then((rows) => { if (active) setWorkouts(rows); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load history.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [auth.session]));

  function toggleEvidence() {
    const next = !evidenceExpanded;
    setEvidenceExpanded(next);
    if (!next || evidence !== null) return;
    const client = getSupabaseClient();
    if (!client) return;
    void loadEvidenceHistory(client)
      .then(setEvidence)
      .catch((cause: unknown) => setEvidenceError(cause instanceof Error ? cause.message : 'Could not load unlinked evidence.'));
  }

  if (!auth.configured) return <Screen eyebrow="HISTORY" title="Training log"><StatusCard title="Connections are not configured" detail="Add the public AGYM connection before loading your history." /></Screen>;
  if (!auth.session) return <Screen eyebrow="HISTORY" title="Training log"><StatusCard title="Sign in required" detail="Sign in to view your owner-scoped training history." /></Screen>;

  const totals = historyTotals(workouts);
  const prs = computeExercisePrs(workouts);

  return (
    <Screen
      eyebrow="HISTORY" title="Training log"
      action={<Button label="+ Log something" variant="tertiary" accessibilityLabel="Log something" onPress={() => router.push('/capture' as never)} />}
    >
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {error ? <StatusCard tone="warning" title="History unavailable" detail={error} /> : null}
        {loading && !workouts.length ? <StatusCard title="Loading history" detail="Checking your confirmed sessions." /> : null}
        {!loading && !workouts.length && !error ? <StatusCard title="No confirmed sessions yet" detail="Complete and confirm a workout to see it here." /> : null}
        {workouts.length ? <Text style={styles.totals}>{totals.sessionCount} confirmed session{totals.sessionCount === 1 ? '' : 's'} · {totals.totalSets} sets · {Math.round(totals.totalVolumeKg)} kg</Text> : null}

        <TrainingDensityGrid />

        {workouts.map((workout) => {
          const card = toSessionCard(workout);
          return (
            <Pressable
              key={workout.id} accessibilityRole="button" accessibilityLabel={card.accessibilityLabel}
              style={styles.card} onPress={() => router.push({ pathname: '/session', params: { id: workout.id } } as never)}
            >
              <View style={styles.cardTopRow}>
                <Text style={styles.confirmed}>✓ USER CONFIRMED · {card.dateLabel} · {card.timeLabel}</Text>
                {card.durationLabel ? <Text style={styles.duration}>{card.durationLabel}</Text> : null}
              </View>
              <Text style={styles.title}>{card.title}</Text>
              <Text style={styles.headline}>{card.headline}</Text>
              {card.deltaLabel ? <Text style={styles.delta}>{card.deltaLabel}</Text> : null}
            </Pressable>
          );
        })}

        {workouts.length ? (
          <>
            <DisclosureRow
              label={`Personal records${prs.length ? ` (${prs.length})` : ''}`}
              expanded={prsExpanded}
              onToggle={() => setPrsExpanded((value) => !value)}
              accessibilityLabel={prsExpanded ? 'Hide personal records' : 'Show personal records'}
            />
            {prsExpanded ? (
              !prs.length ? <StatusCard title="No personal records yet" detail="Complete a workout with logged weight or reps to see records here." />
                : prs.map((pr) => (
                  <View key={pr.exerciseName} style={styles.evidenceCard}>
                    <Text style={styles.evidenceLabel}>{pr.exerciseName}</Text>
                    <Text style={styles.evidenceDetail}>
                      {pr.weightKg !== null ? `${pr.weightKg} kg × ${pr.reps} reps` : `${pr.reps} reps`}
                      {pr.estimatedOneRepMaxKg !== null ? ` · est. 1RM ${pr.estimatedOneRepMaxKg} kg` : ''}
                      {' · '}{formatWeekdayDate(pr.achievedOn)}
                    </Text>
                  </View>
                ))
            ) : null}
          </>
        ) : null}

        <DisclosureRow
          label={`Unlinked evidence${evidence ? ` (${evidence.length})` : ''}`}
          expanded={evidenceExpanded}
          onToggle={toggleEvidence}
          accessibilityLabel={evidenceExpanded ? 'Hide unlinked evidence' : 'Show unlinked evidence'}
        />
        {evidenceExpanded ? (
          evidenceError ? <StatusCard tone="warning" title="Evidence unavailable" detail={evidenceError} />
            : evidence === null ? <StatusCard title="Loading evidence" detail="Checking raw logs and uncertain drafts." />
              : !evidence.length ? <StatusCard title="No unlinked evidence" detail="Raw self-reports and uncertain drafts with no confirmed session appear here." />
                : evidence.map((item) => (
                  <View key={item.id} style={styles.evidenceCard}>
                    <Text style={styles.evidenceLabel}>{item.label}</Text>
                    <Text style={styles.evidenceDetail}>{formatWeekdayDate(item.date)} · {item.detail}</Text>
                  </View>
                ))
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm, paddingBottom: spacing.xl },
  totals: { color: colors.muted, fontSize: 13, fontWeight: '700', marginBottom: spacing.xs },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, borderWidth: 1, gap: spacing.xs, padding: spacing.md },
  cardTopRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  confirmed: { color: colors.green, fontSize: 12, fontWeight: '800' },
  duration: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  headline: { color: colors.muted, lineHeight: 20 },
  delta: { color: colors.orange, fontSize: 13, fontWeight: '700' },
  evidenceCard: { gap: spacing.xs, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  evidenceLabel: { color: colors.orange, fontWeight: '800', fontSize: 12 },
  evidenceDetail: { color: colors.muted, lineHeight: 20 },
});
