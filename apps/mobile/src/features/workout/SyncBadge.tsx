import { Pressable, StyleSheet, Text } from 'react-native';

import { colors } from '@/theme/tokens';

import { describeSyncState } from './syncStatus';
import type { LocalSyncState } from './localDraftStore';

const TONE_COLOR = { neutral: colors.muted, proposal: colors.orange, confirmed: colors.green, warning: colors.gold } as const;

export function SyncBadge({ state, lastSyncError, onRetry }: { state: LocalSyncState; lastSyncError: string | null; onRetry: () => void }) {
  const badge = describeSyncState(state, lastSyncError);
  const content = <Text style={[styles.text, { color: TONE_COLOR[badge.tone] }]}>{badge.glyph} {badge.label}</Text>;
  if (!badge.canRetry) return <Text accessibilityLabel={badge.accessibilityLabel} style={[styles.text, { color: TONE_COLOR[badge.tone] }]}>{badge.glyph} {badge.label}</Text>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={badge.accessibilityLabel} hitSlop={8} onPress={onRetry}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 12, fontWeight: '800' },
});
