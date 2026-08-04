import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';

import { ScreenHeader } from '@/components/ScreenHeader';
import { colors } from '@/theme/tokens';

import { FuturePlanEditorScreen } from '@/features/workout/FuturePlanEditorScreen';
import { WorkoutExecutionScreen } from '@/features/workout/WorkoutExecutionScreen';

export default function WorkoutRoute() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader onBack={() => router.back()} title={mode === 'edit' ? 'Edit workout' : undefined} />
      {mode === 'edit' ? <FuturePlanEditorScreen /> : <WorkoutExecutionScreen />}
    </View>
  );
}
