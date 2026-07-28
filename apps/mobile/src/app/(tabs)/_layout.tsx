import { Tabs } from 'expo-router';
import { colors } from '@/theme/tokens';

export default function TabsLayout() {
  return <Tabs screenOptions={{
    headerShown: false,
    tabBarActiveTintColor: colors.orange,
    tabBarInactiveTintColor: colors.muted,
    tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
    tabBarLabelStyle: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
    tabBarItemStyle: { paddingVertical: 6 },
    tabBarHideOnKeyboard: true,
  }}>
    <Tabs.Screen name="index" options={{ title: 'HOME', tabBarAccessibilityLabel: 'Home tab' }} />
    <Tabs.Screen name="calendar" options={{ title: 'PLANS', tabBarAccessibilityLabel: 'Plans tab' }} />
    <Tabs.Screen name="log" options={{ title: 'HISTORY', tabBarAccessibilityLabel: 'History tab' }} />
    <Tabs.Screen name="data" options={{ title: 'DATA', tabBarAccessibilityLabel: 'Data tab' }} />
  </Tabs>;
}
