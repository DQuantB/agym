import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AuthGate } from '@/auth/AuthGate';
import { AuthProvider } from '@/auth/AuthProvider';
import { colors } from '@/theme/tokens';

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <AuthGate>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Screen name="(tabs)" />
        </Stack>
      </AuthGate>
    </AuthProvider>
  );
}
