import { ScrollView, StyleSheet, Text } from 'react-native';

import { Button } from '@/components/Button';
import { colors, spacing } from '@/theme/tokens';

import { pickInstructionText } from './catalogueDisplay';
import type { CatalogueExercise } from './exerciseCatalogueApi';

type Props = {
  exercise: CatalogueExercise;
  onUse: (exercise: CatalogueExercise) => void;
  onBack: () => void;
};

export function ExerciseDetail({ exercise, onUse, onBack }: Props) {
  const instructions = pickInstructionText(exercise.instructions);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>{exercise.bodyPart.toUpperCase()} · {exercise.equipment}</Text>
      <Text style={styles.title}>{exercise.name}</Text>
      <Text style={styles.meta}>Targets {exercise.target}{exercise.secondaryMuscles.length ? ` · also ${exercise.secondaryMuscles.join(', ')}` : ''}</Text>
      {instructions ? <Text style={styles.instructions}>{instructions}</Text> : (
        <Text style={styles.instructions}>No written instructions available for this exercise.</Text>
      )}
      <Button title={`Use "${exercise.name}"`} variant="primary" onPress={() => onUse(exercise)} />
      <Button title="Back to search" onPress={onBack} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },
  eyebrow: { color: colors.orange, fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
  title: { color: colors.text, fontSize: 24, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 14 },
  instructions: { color: colors.text, fontSize: 15, lineHeight: 22 },
});
