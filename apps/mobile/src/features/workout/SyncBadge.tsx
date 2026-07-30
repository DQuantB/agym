import { Pressable, StyleSheet, Text } from 'react-native';

import { hit, radius, spacing, tone } from '@/theme/tokens';

import { describeSyncState } from './syncStatus';
import type { LocalSyncState } from './localDraftStore';

export function SyncBadge({ state, lastSyncError, onRetry }: { state: LocalSyncState; lastSyncError: string | null; onRetry: () => void }) {
  const badge = describeSyncState(state, lastSyncError);
  const text = <Text style={[styles.text, { color: tone[badge.tone] }]}>{badge.glyph} {badge.label}</Text>;
  if (!badge.canRetry) return <Text accessibilityLabel={badge.accessibilityLabel} style={[styles.text, { color: tone[badge.tone] }]}>{badge.glyph} {badge.label}</Text>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={badge.accessibilityLabel} style={[styles.retry, { borderColor: tone[badge.tone] }]} onPress={onRetry}>
      {text}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 12, fontWeight: '800' },
  retry: { alignItems: 'center', borderRadius: radius.md, borderWidth: 1, justifyContent: 'center', minHeight: hit.min, paddingHorizontal: spacing.sm },
});
