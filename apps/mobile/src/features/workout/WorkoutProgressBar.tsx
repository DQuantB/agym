import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme/tokens';

import { formatProgressLabel, type WorkoutProgress } from './workoutMetrics';

export function WorkoutProgressBar({ progress, exerciseIndex }: { progress: WorkoutProgress; exerciseIndex: number }) {
  const label = formatProgressLabel(progress);
  const exerciseLabel = `Exercise ${exerciseIndex + 1} of ${progress.totalExercises}`;
  return (
    <View style={styles.track} accessibilityLabel={`${label}. ${exerciseLabel}.`}>
      <View style={[styles.fill, { flex: Math.max(progress.settledRatio, 0.02) }]} />
      <View style={{ flex: Math.max(1 - progress.settledRatio, 0.001) }} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { backgroundColor: colors.orange },
  track: { backgroundColor: colors.surfaceRaised, borderRadius: 3, flexDirection: 'row', height: 6, overflow: 'hidden' },
});
