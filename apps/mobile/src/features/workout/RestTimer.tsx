import { AppState, StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from 'react';

import { Button } from '@/components/Button';
import { colors, radius, spacing, type } from '@/theme/tokens';

export function remainingSeconds(endsAt: number | null, now = Date.now()): number {
  return endsAt ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : 0;
}

function display(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

type Props = { endsAt: number | null; onAddTime: () => void; onDismiss: () => void };

export function RestTimer({ endsAt, onAddTime, onDismiss }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!endsAt) return;
    const tick = () => setNow(Date.now());
    const interval = setInterval(tick, 1_000);
    const subscription = AppState.addEventListener('change', tick);
    return () => { clearInterval(interval); subscription.remove(); };
  }, [endsAt]);

  const seconds = remainingSeconds(endsAt, now);
  if (!endsAt || seconds === 0) return null;

  return (
    <View style={styles.card} accessibilityLabel={`Rest timer, ${display(seconds)} remaining`}>
      <Text style={styles.label}>● REST · {display(seconds)}</Text>
      <View style={styles.actions}>
        <Button label="+30 sec" variant="secondary" accessibilityLabel="Add 30 seconds of rest" onPress={onAddTime} />
        <Button label="End rest" variant="secondary" accessibilityLabel="End rest now" onPress={onDismiss} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', backgroundColor: colors.surfaceRaised, borderColor: colors.orange, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between', padding: spacing.sm },
  label: { ...type.heading, color: colors.orange },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
