import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { ScreenHeader } from '@/components/ScreenHeader';
import { SessionDetailScreen } from '@/features/log/SessionDetailScreen';
import { colors } from '@/theme/tokens';

export default function SessionRoute() {
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader onBack={() => router.back()} />
      <SessionDetailScreen />
    </View>
  );
}
