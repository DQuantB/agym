import { AppState, Button, StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from 'react';

import { colors, spacing } from '@/theme/tokens';

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

  return <View style={styles.card}><Text style={styles.label}>REST TIMER · {display(seconds)}</Text><View style={styles.actions}><Button title="+30 sec" onPress={onAddTime} /><Button title="End rest" onPress={onDismiss} /></View></View>;
}

const styles = StyleSheet.create({ card: { gap: spacing.xs, borderColor: colors.orange, borderWidth: 1, borderRadius: 12, padding: spacing.sm }, label: { color: colors.text, fontWeight: '700' }, actions: { flexDirection: 'row', gap: spacing.sm } });
