import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { StatusCard } from '@/components/Screen';
import { formatWeekdayDate } from '@/lib/dateLabels';
import { getSupabaseClient } from '@/lib/supabase';
import { colors, hit, radius, spacing, trainingDensity } from '@/theme/tokens';

import { loadTrainingGridRange } from './logApi';
import {
  buildTrainingGridDays,
  chunkIntoWeeks,
  densityStep,
  gridCellAccessibilityLabel,
  maxMetricMagnitude,
  trainingGridRangeEndingToday,
  type GridMetric,
  type TrainingGridCell,
} from './trainingGrid';
import { formatVolumeKg } from '../workout/workoutMetrics';

const METRICS: { key: GridMetric; label: string }[] = [
  { key: 'volume', label: 'Volume' },
  { key: 'sets', label: 'Sets' },
  { key: 'adherence', label: 'Adherence' },
];
const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// Matches the local-date convention used elsewhere (PlansScreen, TodayScreen,
// WorkoutExecutionScreen), not the UTC one CaptureScreen uses.
function todayLocalDate(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function selectedDetail(cell: TrainingGridCell, metric: GridMetric): string {
  if (cell.sessionCount === 0) return 'No training logged.';
  if (metric === 'adherence') {
    return cell.plannedSets === null
      ? `${cell.sessionCount} session(s), no planned reference available.`
      : `${cell.completedSets} of ${cell.plannedSets} planned sets completed.`;
  }
  if (metric === 'sets') return `${cell.completedSets} sets completed across ${cell.sessionCount} session(s).`;
  return `${formatVolumeKg(cell.volumeKg)} across ${cell.sessionCount} session(s).`;
}

export function TrainingDensityGrid() {
  const auth = useAuth();
  const [cells, setCells] = useState<TrainingGridCell[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState<GridMetric>('volume');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    const client = getSupabaseClient();
    if (!client || !auth.session) return undefined;
    let active = true;
    setLoading(true);
    setError(null);
    const { fromDate, toDate } = trainingGridRangeEndingToday(todayLocalDate());
    void loadTrainingGridRange(client, fromDate, toDate)
      .then((rows) => { if (active) setCells(buildTrainingGridDays(fromDate, toDate, rows)); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load training history.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [auth.session]));

  if (error) return <StatusCard tone="warning" title="Training density unavailable" detail={error} />;
  if (loading && !cells.length) return <StatusCard title="Loading training density" detail="Checking your last 12 weeks of confirmed sessions." />;
  if (!cells.length) return null;

  const weeks = chunkIntoWeeks(cells);
  const max = maxMetricMagnitude(cells, metric);
  const selected = selectedDate ? cells.find((cell) => cell.date === selectedDate) ?? null : null;

  return (
    <View style={styles.container}>
      <View style={styles.metricRow}>
        {METRICS.map((option) => (
          <Pressable
            key={option.key} accessibilityRole="button" accessibilityLabel={`Show ${option.label.toLowerCase()} density`}
            accessibilityState={{ selected: metric === option.key }}
            style={[styles.metricChip, metric === option.key ? styles.metricChipActive : null]}
            onPress={() => setMetric(option.key)}
          >
            <Text style={[styles.metricChipText, metric === option.key ? styles.metricChipTextActive : null]}>{option.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.gridRow}>
        <View style={styles.weekdayColumn} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {WEEKDAY_LABELS.map((label, index) => (
            <View key={index} style={styles.weekdayLabelRow}>
              <Text style={styles.weekdayLabel}>{label}</Text>
            </View>
          ))}
        </View>
        {weeks.map((week, weekIndex) => (
          <View key={weekIndex} style={styles.weekColumn}>
            {week.map((cell) => {
              const step = densityStep(cell, metric, max);
              const dateLabel = formatWeekdayDate(cell.date);
              return (
                <Pressable
                  key={cell.date} accessibilityRole="button" accessibilityLabel={gridCellAccessibilityLabel(cell, metric, dateLabel)}
                  hitSlop={6}
                  style={[styles.cell, { backgroundColor: trainingDensity[step] }, selectedDate === cell.date ? styles.cellSelected : null]}
                  onPress={() => setSelectedDate((current) => (current === cell.date ? null : cell.date))}
                />
              );
            })}
          </View>
        ))}
      </View>

      <View style={styles.legendRow}>
        <Text style={styles.legendLabel}>Less</Text>
        {trainingDensity.map((color, step) => <View key={step} style={[styles.legendSwatch, { backgroundColor: color }]} />)}
        <Text style={styles.legendLabel}>More</Text>
      </View>
      {max > 0 ? <Text style={styles.legendCaption}>Darkest = at least 75% of your busiest day in this window.</Text> : null}

      {selected ? <StatusCard title={formatWeekdayDate(selected.date)} detail={selectedDetail(selected, metric)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  metricRow: { flexDirection: 'row', gap: spacing.xs },
  metricChip: { alignItems: 'center', borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, justifyContent: 'center', minHeight: hit.min, paddingHorizontal: spacing.md },
  metricChipActive: { backgroundColor: colors.surfaceRaised, borderColor: colors.orange },
  metricChipText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  metricChipTextActive: { color: colors.orange },
  gridRow: { flexDirection: 'row', gap: 3 },
  weekdayColumn: { gap: 3, marginRight: spacing.xs },
  weekdayLabelRow: { alignItems: 'center', flex: 1, justifyContent: 'center', width: 14 },
  weekdayLabel: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  weekColumn: { flex: 1, gap: 3 },
  cell: { aspectRatio: 1, borderRadius: radius.sm, flex: 1 },
  cellSelected: { borderColor: colors.text, borderWidth: 1.5 },
  legendRow: { alignItems: 'center', flexDirection: 'row', gap: 4, marginTop: spacing.xs },
  legendLabel: { color: colors.muted, fontSize: 11 },
  legendSwatch: { borderRadius: radius.sm, height: 12, width: 12 },
  legendCaption: { color: colors.muted, fontSize: 11 },
});
