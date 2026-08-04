import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, hit, radius, spacing } from '@/theme/tokens';

type Variant = 'primary' | 'secondary' | 'danger';

type Props = {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  accessibilityLabel?: string;
};

/** Themed replacement for React Native's default `Button`, which renders as an unstyled OS-native control and breaks AGYM's dark/orange design system. */
export function Button({ title, onPress, variant = 'secondary', disabled = false, accessibilityLabel }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      style={[styles.base, variantStyles[variant], disabled && styles.disabled]}
      onPress={onPress}
    >
      <Text style={[styles.text, variantTextStyles[variant]]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, minHeight: hit.min, paddingHorizontal: spacing.md },
  primary: { backgroundColor: colors.orange },
  secondary: { borderColor: colors.border, borderWidth: 1 },
  danger: { borderColor: colors.danger, borderWidth: 1 },
  disabled: { opacity: 0.5 },
  text: { fontSize: 14, fontWeight: '700', letterSpacing: 0.3 },
  primaryText: { color: colors.background, fontWeight: '800' },
  secondaryText: { color: colors.text },
  dangerText: { color: colors.danger },
});

const variantStyles = { primary: styles.primary, secondary: styles.secondary, danger: styles.danger };
const variantTextStyles = { primary: styles.primaryText, secondary: styles.secondaryText, danger: styles.dangerText };
