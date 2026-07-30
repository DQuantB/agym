import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { resolveButtonVisual, type ButtonVariant } from './buttonVariant';

type Props = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  busy?: boolean;
  accessibilityLabel?: string;
  fullWidth?: boolean;
};

export function Button({ label, onPress, variant = 'secondary', disabled, busy, accessibilityLabel, fullWidth }: Props) {
  const isDisabled = Boolean(disabled || busy);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: Boolean(busy) }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => {
        const visual = resolveButtonVisual(variant, { pressed, disabled: isDisabled });
        return [
          styles.base,
          fullWidth ? styles.fullWidth : null,
          {
            backgroundColor: visual.backgroundColor,
            borderColor: visual.borderColor,
            borderWidth: visual.borderWidth,
            borderRadius: visual.borderRadius,
            minHeight: visual.minHeight,
            opacity: visual.opacity,
          },
        ];
      }}
    >
      {busy ? <ActivityIndicator color={resolveButtonVisual(variant).textColor} /> : null}
      <Text
        style={{
          color: resolveButtonVisual(variant).textColor,
          fontSize: resolveButtonVisual(variant).fontSize,
          fontWeight: resolveButtonVisual(variant).fontWeight,
          letterSpacing: resolveButtonVisual(variant).letterSpacing,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 8, justifyContent: 'center', paddingHorizontal: 16 },
  fullWidth: { alignSelf: 'stretch' },
});
