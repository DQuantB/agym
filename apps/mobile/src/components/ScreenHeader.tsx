import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme/tokens';

type Props = { onBack: () => void; title?: string; right?: ReactNode };

export function ScreenHeader({ onBack, title, right }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.row, { paddingTop: insets.top + spacing.sm }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" hitSlop={8} onPress={onBack} style={styles.back}>
        <Text style={styles.backText}>‹</Text>
      </Pressable>
      {title ? <Text style={styles.title} numberOfLines={1}>{title}</Text> : <View style={styles.spacer} />}
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, paddingBottom: spacing.sm, paddingHorizontal: spacing.lg },
  back: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  backText: { color: colors.text, fontSize: 28, lineHeight: 30 },
  title: { color: colors.text, flex: 1, fontSize: 16, fontWeight: '700' },
  spacer: { flex: 1 },
  right: { alignItems: 'flex-end', minWidth: 44 },
});
