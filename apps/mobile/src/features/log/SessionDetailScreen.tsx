import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { StatusCard } from '@/components/Screen';
import { getSupabaseClient } from '@/lib/supabase';
import { computeWorkoutProgress, formatVolumeKg } from '@/features/workout/workoutMetrics';
import { colors, radius, spacing, type } from '@/theme/tokens';

import type { ConfirmedWorkout } from './confirmedWorkout';
import { loadConfirmedWorkoutDetail, type RawEvidence } from './logApi';
import { summarizeSession } from './sessionSummary';

type LoadState = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'missing' } | { kind: 'ready' };

export function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const auth = useAuth();
  const router = useRouter();
  const [workout, setWorkout] = useState<ConfirmedWorkout | null>(null);
  const [rawEvidence, setRawEvidence] = useState<RawEvidence | null>(null);
  const [loadState, setLoadState] = useState<LoadState>({ kind: 'loading' });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    setLoadState({ kind: 'loading' });
    const client = getSupabaseClient();
    if (!id || !client || !auth.session) {
      setLoadState({ kind: 'error', message: 'This device has no public AGYM data connection yet.' });
      return;
    }
    void loadConfirmedWorkoutDetail(client, id).then((value) => {
      if (!value) { setLoadState({ kind: 'missing' }); return; }
      setWorkout(value.workout);
      setRawEvidence(value.rawEvidence);
      setLoadState({ kind: 'ready' });
    }).catch((error: unknown) => setLoadState({ kind: 'error', message: error instanceof Error ? error.message : 'Could not load this session.' }));
  }, [auth.session, id, reloadToken]);

  if (!workout) return (
    <View style={styles.screen}>
      <View style={styles.statusStack}>
        {loadState.kind === 'loading' ? (
          <StatusCard busy title="Loading session" detail="Fetching this confirmed session and its raw evidence." />
        ) : null}
        {loadState.kind === 'error' ? (
          <>
            <StatusCard tone="warning" title="Session unavailable" detail={loadState.message} />
            <Button label="Retry" variant="secondary" fullWidth onPress={() => setReloadToken((token) => token + 1)} />
          </>
        ) : null}
        {loadState.kind === 'missing' ? (
          <>
            <StatusCard title="Session not available" detail="This confirmed session is no longer available." />
            <Button label="Back to history" variant="secondary" fullWidth onPress={() => router.back()} />
          </>
        ) : null}
      </View>
    </View>
  );

  const summary = summarizeSession(workout);
  const card = summary.card;
  const progress = computeWorkoutProgress(workout.actual);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.confirmed}>✓ USER CONFIRMED · {card.dateLabel} · {card.timeLabel}</Text>
      <Text style={styles.title}>{card.title}</Text>
      <Text style={styles.message}>Immutable. Confirming never changed the plan or the raw evidence.</Text>

      <View style={styles.metricsRow}>
        {card.durationLabel ? <View style={styles.metric}><Text style={styles.metricValue}>{card.durationLabel}</Text><Text style={styles.metricLabel}>duration</Text></View> : null}
        <View style={styles.metric}><Text style={styles.metricValue}>{progress.completedSets} of {progress.totalSets}</Text><Text style={styles.metricLabel}>{card.skippedCount} skipped</Text></View>
        <View style={styles.metric}><Text style={styles.metricValue}>{formatVolumeKg(summary.volume.kg)}</Text><Text style={styles.metricLabel}>{summary.volume.bodyweightSets > 0 ? `${summary.volume.bodyweightSets} bodyweight excluded` : 'load volume'}</Text></View>
      </View>

      {summary.exercises.map((exercise) => (
        <View key={exercise.name} style={styles.card}>
          <View style={styles.exerciseHeaderRow}>
            <Text style={styles.exerciseName}>{exercise.name}</Text>
            {exercise.userAdded ? <Text style={styles.addedChip}>+ ADDED</Text> : null}
            {exercise.substitutedFrom ? <Text style={styles.addedChip}>↺ SUBSTITUTED FOR {exercise.substitutedFrom.toUpperCase()}</Text> : null}
          </View>
          {exercise.rows.map((row) => (
            <View key={row.ordinal} style={styles.setRow}>
              <Text style={styles.setOrdinal}>#{row.ordinal}</Text>
              <Text style={styles.setPlanned}>{row.plannedLabel}</Text>
              <Text style={styles.setActual}>{row.actualLabel}</Text>
              {row.deltaLabel ? <Text style={styles.setDelta}>{row.deltaLabel}</Text> : null}
              {row.skippedReason ? <Text style={styles.setDelta}>“{row.skippedReason}”</Text> : null}
            </View>
          ))}
          <Text style={styles.exerciseVolume}>Exercise volume {formatVolumeKg(exercise.volumeKg)}</Text>
        </View>
      ))}

      {summary.notPerformed.length ? (
        <View style={styles.card}>
          <Text style={styles.exerciseName}>◇ Planned · not performed</Text>
          {summary.notPerformed.map((item) => (
            <Text key={item.name} style={styles.message}>{item.name} · {item.plannedSetCount} set{item.plannedSetCount === 1 ? '' : 's'} planned</Text>
          ))}
        </View>
      ) : null}

      {workout.notes ? (
        <View style={styles.card}>
          <Text style={styles.exerciseName}>Your note</Text>
          <Text style={styles.message} selectable>{workout.notes}</Text>
        </View>
      ) : null}

      {rawEvidence ? (
        <View style={styles.card}>
          <Text style={styles.exerciseName}>RAW SELF-REPORT</Text>
          <Text style={styles.message} selectable>{rawEvidence.text}</Text>
          <Text style={styles.message}>Preserved verbatim. Your confirmation never overwrote this evidence.</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  statusStack: { gap: spacing.md, padding: spacing.lg },
  content: { padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.md },
  confirmed: { color: colors.green, fontSize: 12, fontWeight: '800' },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  message: { color: colors.muted, lineHeight: 20 },
  metricsRow: { flexDirection: 'row', gap: spacing.md },
  metric: { flex: 1, gap: 2 },
  metricValue: { ...type.heading, color: colors.text },
  metricLabel: { color: colors.muted, fontSize: 12 },
  card: { backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderRadius: radius.lg, borderWidth: 1, gap: spacing.xs, padding: spacing.md },
  exerciseHeaderRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  exerciseName: { color: colors.text, fontSize: 17, fontWeight: '700' },
  addedChip: { backgroundColor: colors.surface, borderRadius: radius.pill, color: colors.orange, fontSize: 11, fontWeight: '800', paddingHorizontal: spacing.xs, paddingVertical: 2 },
  setRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  setOrdinal: { color: colors.muted, fontSize: 13, fontWeight: '700', width: 24 },
  setPlanned: { color: colors.muted, fontSize: 14 },
  setActual: { color: colors.text, fontSize: 14, fontWeight: '700' },
  setDelta: { color: colors.gold, fontSize: 13 },
  exerciseVolume: { color: colors.muted, fontSize: 12, marginTop: spacing.xs },
});
