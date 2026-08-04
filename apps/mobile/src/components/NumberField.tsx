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
  disabled?: boolean;
};

export function NumberField({ label, value, onChangeText, onDecrement, onIncrement, decrementLabel, incrementLabel, keyboardType, accessibilityLabel, disabled }: Props) {
  // Committing every keystroke to the parent used to run onChangeText through
  // a whole-plan structuredClone + re-render on every character. That's slow
  // enough on a real device to hit React Native's known issue where a
  // controlled TextInput's native text gets clobbered by a stale JS value
  // mid-keystroke, once the JS thread falls behind the native input --
  // typing "40" could visibly commit as "4" if the second keystroke's native
  // event landed while a prior render was still in flight. Buffer locally
  // while focused and commit to the parent only on blur (and immediately for
  // the +/- steppers, which don't go through this buffer at all) so the
  // parent never re-renders mid-keystroke.
  const [text, setText] = useState(value);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(value);
  }, [value]);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" accessibilityLabel={decrementLabel} hitSlop={8} disabled={disabled} onPress={onDecrement} style={[styles.step, disabled ? styles.stepDisabled : null]}>
          <Text style={styles.stepText}>−</Text>
        </Pressable>
        <TextInput
          accessibilityLabel={accessibilityLabel}
          style={styles.value}
          keyboardType={keyboardType}
          selectTextOnFocus
          editable={!disabled}
          value={text}
          onFocus={() => { focused.current = true; }}
          onBlur={() => { focused.current = false; onChangeText(text); }}
          onChangeText={setText}
        />
        <Pressable accessibilityRole="button" accessibilityLabel={incrementLabel} hitSlop={8} disabled={disabled} onPress={onIncrement} style={[styles.step, disabled ? styles.stepDisabled : null]}>
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
  stepDisabled: { opacity: 0.5 },
  stepText: { color: colors.text, fontSize: 24, fontWeight: '700' },
  value: { ...type.metric, color: colors.text, flex: 1, textAlign: 'center' },
});
