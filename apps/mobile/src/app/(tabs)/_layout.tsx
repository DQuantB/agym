import { Tabs } from 'expo-router';
import { colors } from '@/theme/tokens';

export default function TabsLayout() {
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.orange, tabBarInactiveTintColor: colors.muted, tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border }, tabBarLabelStyle: { fontSize: 11, fontWeight: '700' } }}>
    <Tabs.Screen name="index" options={{ title: 'TODAY' }} />
    <Tabs.Screen name="calendar" options={{ title: 'PLANS' }} />
    <Tabs.Screen name="log" options={{ title: 'LOG' }} />
    <Tabs.Screen name="data" options={{ title: 'DATA' }} />
  </Tabs>;
}
