import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { colors } from '@/theme/tokens';

function tabIcon(focused: keyof typeof Ionicons.glyphMap, outline: keyof typeof Ionicons.glyphMap) {
  function TabIcon({ color, size, focused: isFocused }: { color: string; size: number; focused: boolean }) {
    return <Ionicons name={isFocused ? focused : outline} size={size} color={color} />;
  }
  return TabIcon;
}

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
    <Tabs.Screen name="index" options={{ title: 'HOME', tabBarAccessibilityLabel: 'Home tab', tabBarIcon: tabIcon('home', 'home-outline') }} />
    <Tabs.Screen name="calendar" options={{ title: 'PLANS', tabBarAccessibilityLabel: 'Plans tab', tabBarIcon: tabIcon('calendar', 'calendar-outline') }} />
    <Tabs.Screen name="log" options={{ title: 'HISTORY', tabBarAccessibilityLabel: 'History tab', tabBarIcon: tabIcon('time', 'time-outline') }} />
    <Tabs.Screen name="data" options={{ title: 'DATA', tabBarAccessibilityLabel: 'Data tab', tabBarIcon: tabIcon('shield-checkmark', 'shield-checkmark-outline') }} />
  </Tabs>;
}
