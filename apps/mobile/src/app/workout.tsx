import { useLocalSearchParams } from 'expo-router';

import { FuturePlanEditorScreen } from '@/features/workout/FuturePlanEditorScreen';
import { WorkoutExecutionScreen } from '@/features/workout/WorkoutExecutionScreen';

export default function WorkoutRoute() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  return mode === 'edit' ? <FuturePlanEditorScreen /> : <WorkoutExecutionScreen />;
}
