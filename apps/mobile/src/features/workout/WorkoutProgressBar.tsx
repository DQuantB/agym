import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/theme/tokens';

import { formatProgressLabel, type WorkoutProgress } from './workoutMetrics';

export function WorkoutProgressBar({ progress, exerciseIndex }: { progress: WorkoutProgress; exerciseIndex: number }) {
  const label = formatProgressLabel(progress);
  const exerciseLabel = `Exercise ${exerciseIndex + 1} of ${progress.totalExercises}`;
  return (
    <View style={styles.wrap} accessibilityLabel={`${label}. ${exerciseLabel}.`}>
      <View style={styles.row}>
        <Text style={styles.label}>{label.toUpperCase()}</Text>
        <Text style={styles.label}>{exerciseLabel.toUpperCase()}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { flex: Math.max(progress.settledRatio, 0.02) }]} />
        <View style={{ flex: Math.max(1 - progress.settledRatio, 0.001) }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  track: { backgroundColor: colors.surfaceRaised, borderRadius: 3, flexDirection: 'row', height: 6, overflow: 'hidden' },
  fill: { backgroundColor: colors.orange },
});
