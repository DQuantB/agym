import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';

import { ScreenHeader } from '@/components/ScreenHeader';
import { colors } from '@/theme/tokens';

import { CreateWorkoutScreen } from '@/features/workout/CreateWorkoutScreen';
import { FuturePlanEditorScreen } from '@/features/workout/FuturePlanEditorScreen';
import { WorkoutExecutionScreen } from '@/features/workout/WorkoutExecutionScreen';

const TITLES: Record<string, string> = { edit: 'Edit workout', create: 'Create workout' };

export default function WorkoutRoute() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader onBack={() => router.back()} title={mode ? TITLES[mode] : undefined} />
      {mode === 'edit' ? <FuturePlanEditorScreen /> : mode === 'create' ? <CreateWorkoutScreen /> : <WorkoutExecutionScreen />}
    </View>
  );
}
