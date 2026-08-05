import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fabBottomOffset } from '@/lib/fabPlacement';
import { colors, hit, spacing } from '@/theme/tokens';

const TAB_BAR_CONTENT_HEIGHT = 56;

export function FeedbackFab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottom = fabBottomOffset(insets.bottom, TAB_BAR_CONTENT_HEIGHT, spacing.md);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Give feedback"
      hitSlop={4}
      style={[styles.fab, { bottom }]}
      onPress={() => router.push('/feedback' as never)}
    >
      <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    alignItems: 'center', backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderRadius: hit.primary / 2,
    borderWidth: 1, height: hit.primary, justifyContent: 'center', position: 'absolute', right: spacing.lg, width: hit.primary,
  },
});
