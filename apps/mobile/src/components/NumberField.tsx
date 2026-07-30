import { useEffect, useRef, useState } from 'react';
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
  // `value` is the parent's canonical, reformatted number (e.g. "50." -> "50"
  // as soon as it round-trips through the reducer). Mirroring it straight
  // into a controlled TextInput fights the user mid-keystroke -- typing "50"
  // can visibly stall on "5", and a trailing decimal point gets stripped
  // before the next digit lands. Buffer what's on screen locally instead,
  // and only resync from the parent while the field isn't focused (i.e. for
  // external changes: the +/- steppers, or switching to a different set).
  const [text, setText] = useState(value);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(value);
  }, [value]);

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
          value={text}
          onFocus={() => { focused.current = true; }}
          onBlur={() => { focused.current = false; setText(value); }}
          onChangeText={(next) => { setText(next); onChangeText(next); }}
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
