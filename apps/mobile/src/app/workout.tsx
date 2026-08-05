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
  // The execution screen owns its own compact top bar instead of ScreenHeader —
  // every pixel matters mid-set, and gestureEnabled is false for this route
  // because leaving mid-session is dangerous, which an unguarded back chevron undermines.
  if (!mode) return <View style={{ flex: 1, backgroundColor: colors.background }}><WorkoutExecutionScreen onExit={() => router.back()} /></View>;
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader onBack={() => router.back()} title={TITLES[mode]} />
      {mode === 'edit' ? <FuturePlanEditorScreen /> : <CreateWorkoutScreen />}
    </View>
  );
}
