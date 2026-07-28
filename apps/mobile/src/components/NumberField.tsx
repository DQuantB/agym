import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, radius, spacing, type } from '@/theme/tokens';

type Props = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  onDecrement: () => void;
  onIncrement: () => void;
  decrementLabel: string;
  incrementLabel: string;
  keyboardType: 'decimal-pad' | 'number-pad';
  accessibilityLabel: string;
};

export function NumberField({ label, value, onChangeText, onDecrement, onIncrement, decrementLabel, incrementLabel, keyboardType, accessibilityLabel }: Props) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" accessibilityLabel={decrementLabel} hitSlop={8} onPress={onDecrement} style={styles.step}>
          <Text style={styles.stepText}>−</Text>
        </Pressable>
        <TextInput
          accessibilityLabel={accessibilityLabel}
          style={styles.value}
          keyboardType={keyboardType}
          selectTextOnFocus
          value={value}
          onChangeText={onChangeText}
        />
        <Pressable accessibilityRole="button" accessibilityLabel={incrementLabel} hitSlop={8} onPress={onIncrement} style={styles.step}>
          <Text style={styles.stepText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flex: 1, gap: spacing.xs },
  label: { color: colors.muted, fontWeight: '700', fontSize: 12, letterSpacing: 1 },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  step: { alignItems: 'center', borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, height: 48, justifyContent: 'center', width: 48 },
  stepText: { color: colors.text, fontSize: 24, fontWeight: '700' },
  value: { ...type.metric, color: colors.text, flex: 1, textAlign: 'center' },
});
