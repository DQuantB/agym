import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, hit, radius, spacing } from '@/theme/tokens';

import type { ExerciseRow } from './exerciseBrowserModel';

export function ExercisePillStrip({ rows, onFocusExercise }: { rows: ExerciseRow[]; onFocusExercise: (exerciseId: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stripScroll} contentContainerStyle={styles.stripContent}>
      {rows.map((row) => (
        <Pressable
          key={row.exerciseId}
          accessibilityRole="button"
          accessibilityLabel={`Go to ${row.accessibilityLabel}`}
          accessibilityState={{ selected: row.isFocused }}
          style={[styles.pill, row.isFocused ? styles.pillActive : null]}
          onPress={() => onFocusExercise(row.exerciseId)}
        >
          <Text style={[styles.pillText, row.isFocused ? styles.pillTextActive : null]} numberOfLines={1}>{row.pillLabel}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export function ExerciseBrowserPanel({ rows, onChipPress }: { rows: ExerciseRow[]; onChipPress: (exerciseIndex: number, setIndex: number) => void }) {
  return (
    <View style={styles.panel}>
      {rows.map((row) => (
        <View key={row.exerciseId} style={styles.panelRow}>
          <View style={styles.panelRowHeader}>
            <Text style={styles.panelRowName} numberOfLines={1}>{row.pillLabel}</Text>
            <Text style={styles.panelRowSummary}>{row.summary}</Text>
          </View>
          <View style={styles.chipsRow}>
            {row.chips.map((chip) => (
              <Pressable
                key={chip.setIndex}
                accessibilityRole="button"
                accessibilityLabel={chip.accessibilityLabel}
                style={[styles.chip, chip.isFocused ? styles.chipActive : null]}
                onPress={() => onChipPress(row.exerciseIndex, chip.setIndex)}
              >
                <Text style={[styles.chipText, chip.isFocused ? styles.chipTextActive : null]}>{chip.glyph} {chip.setIndex + 1}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { alignItems: 'center', borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, justifyContent: 'center', minHeight: hit.min, minWidth: hit.min, paddingHorizontal: spacing.sm },
  chipActive: { backgroundColor: colors.surfaceRaised, borderColor: colors.orange },
  chipText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: colors.orange },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  panel: { backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderRadius: radius.lg, borderWidth: 1, gap: spacing.md, padding: spacing.md },
  panelRow: { gap: spacing.xs },
  panelRowHeader: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  panelRowName: { color: colors.text, flex: 1, fontSize: 15, fontWeight: '700' },
  panelRowSummary: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  pill: { alignItems: 'center', borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, height: hit.min, justifyContent: 'center', paddingHorizontal: spacing.sm },
  pillActive: { backgroundColor: colors.surfaceRaised, borderColor: colors.orange },
  pillText: { color: colors.muted, fontSize: 13, fontWeight: '700', maxWidth: 140 },
  pillTextActive: { color: colors.orange },
  stripContent: { alignItems: 'center', gap: spacing.xs },
  stripScroll: { flex: 1 },
});
