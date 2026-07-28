import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/theme/tokens';

import { formatPlannedSetLabel, type PlannedSetRef } from './plannedReference';

export function PlannedReferenceRow({ reference, delta }: { reference: PlannedSetRef; delta: string | null }) {
  return (
    <View style={styles.row} accessibilityLabel={`${formatPlannedSetLabel(reference)}${delta ? `. ${delta}` : ''}`}>
      <Text style={styles.label}>{formatPlannedSetLabel(reference)}</Text>
      {delta ? <Text style={styles.delta}>{delta}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { borderColor: colors.orange, borderLeftWidth: 3, borderRadius: radius.sm, gap: 2, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  label: { color: colors.text, fontSize: 14, fontWeight: '700' },
  delta: { color: colors.gold, fontSize: 12, fontWeight: '700' },
});
