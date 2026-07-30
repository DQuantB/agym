import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, hit, spacing } from '@/theme/tokens';

type Props = {
  label: string;
  expanded: boolean;
  onToggle: () => void;
  accessibilityLabel?: string;
};

export function DisclosureRow({ label, expanded, onToggle, accessibilityLabel }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ expanded }}
      style={styles.disclosure}
      onPress={onToggle}
    >
      <Text style={styles.disclosureText}>{expanded ? '▾' : '▸'} {label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  disclosure: { justifyContent: 'center', marginTop: spacing.sm, minHeight: hit.min },
  disclosureText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
});
