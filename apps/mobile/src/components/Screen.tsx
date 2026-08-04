import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing, tone } from '@/theme/tokens';

type Props = {
  eyebrow: string;
  title: string;
  children: ReactNode;
  action?: ReactNode;
  onBack?: () => void;
};

export function Screen({ eyebrow, title, children, action, onBack }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.lg }]}>
      <View style={styles.headerRow}>
        {onBack ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" hitSlop={8} onPress={onBack} style={styles.back}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
        ) : null}
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <Text style={styles.title}>{title}</Text>
        </View>
        {action ? <View style={styles.action}>{action}</View> : null}
      </View>
      {children}
    </View>
  );
}

export function StatusCard({ title, detail, tone: statusTone = 'neutral' }: { title: string; detail: string; tone?: keyof typeof tone }) {
  return <View style={styles.card}><Text style={[styles.cardTitle, { color: tone[statusTone] }]}>{title}</Text><Text style={styles.detail}>{detail}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg, gap: spacing.md },
  headerRow: { alignItems: 'flex-end', flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  back: { alignItems: 'center', height: 44, justifyContent: 'center', marginBottom: 4, width: 44 },
  backText: { color: colors.text, fontSize: 28, lineHeight: 30 },
  headerText: { flex: 1 },
  action: { paddingBottom: 6 },
  eyebrow: { color: colors.orange, fontSize: 12, fontWeight: '700', letterSpacing: 1.5 },
  title: { color: colors.text, fontSize: 34, fontWeight: '700' },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: spacing.md, gap: spacing.xs },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  detail: { color: colors.muted, fontSize: 14, lineHeight: 20 },
});
