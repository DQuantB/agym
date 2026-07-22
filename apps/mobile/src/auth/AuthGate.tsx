import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { SignInScreen } from '@/auth/SignInScreen';
import { useAuth } from '@/auth/AuthProvider';
import { colors } from '@/theme/tokens';

export function AuthGate({ children }: { children: ReactNode }) {
  const { configured, ready, session } = useAuth();

  if (!configured) {
    return (
      <View style={styles.page}>
        <Text style={styles.title}>AGYM configuration needed</Text>
        <Text style={styles.copy}>Add the public Supabase URL and publishable key to the mobile app configuration before signing in.</Text>
      </View>
    );
  }

  if (!ready) {
    return <View accessibilityLabel="Restoring private session" style={styles.page}><ActivityIndicator color={colors.orange} /><Text style={styles.copy}>Restoring your private session…</Text></View>;
  }

  if (!session) return <SignInScreen />;
  return <>{children}</>;
}

const styles = StyleSheet.create({
  page: { alignItems: 'center', backgroundColor: colors.background, flex: 1, gap: 16, justifyContent: 'center', padding: 24 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800', textAlign: 'center' },
  copy: { color: colors.muted, fontSize: 16, lineHeight: 23, maxWidth: 420, textAlign: 'center' },
});
