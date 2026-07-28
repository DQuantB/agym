import { useEffect, useState } from 'react';
import { Alert, Button, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { getSupabaseClient } from '@/lib/supabase';
import { colors, spacing } from '@/theme/tokens';

import { loadGymPlan, replaceFutureGymWorkoutPlan, type GymPlan } from './workoutApi';

const standardRestSeconds = 120;

export function FuturePlanEditorScreen() {
  const router = useRouter();
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const [plan, setPlan] = useState<GymPlan | null>(null);
  const [message, setMessage] = useState('Loading scheduled workout…');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client || !planId) { setMessage('This scheduled workout is unavailable.'); return; }
    void loadGymPlan(client, planId).then((loaded) => {
      if (!loaded) setMessage('This accepted Gym workout is unavailable.');
      else { setPlan(loaded); setMessage('Adjust the future workout. The original agent plan remains preserved.'); }
    }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Could not load scheduled workout.'));
  }, [planId]);

  function mutate(change: (next: GymPlan) => void) {
    if (!plan) return;
    const next = structuredClone(plan);
    change(next);
    setPlan(next);
  }

  async function save() {
    const client = getSupabaseClient();
    if (!client || !plan || !planId) return;
    setSaving(true);
    try {
      await replaceFutureGymWorkoutPlan(client, planId, plan);
      Alert.alert('Future workout saved', 'Your adjustment is saved. The original agent plan remains available as the baseline.', [{ text: 'Done', onPress: () => router.back() }]);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save this future workout.'); }
    finally { setSaving(false); }
  }

  if (!plan) return <View style={styles.screen}><Text style={styles.message}>{message}</Text></View>;
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text style={styles.eyebrow}>◇ FUTURE WORKOUT · USER REVISION</Text><Text style={styles.title}>{plan.title}</Text><Text style={styles.message}>{message}</Text>
    {plan.exercises.map((exercise, exerciseIndex) => <View key={`${exercise.client_id}-${exerciseIndex}`} style={styles.card}>
      <Text style={styles.label}>Exercise {exerciseIndex + 1}</Text>
      <TextInput accessibilityLabel={`Exercise ${exerciseIndex + 1} name`} style={styles.input} value={exercise.name} onChangeText={(name) => mutate((next) => { next.exercises[exerciseIndex].name = name; })} />
      {exercise.sets.map((set, setIndex) => <View key={setIndex} style={styles.set}>
        <Text style={styles.label}>Set {setIndex + 1}</Text><View style={styles.row}>
          <View style={styles.field}><Text style={styles.label}>kg</Text><TextInput accessibilityLabel={`${exercise.name} set ${setIndex + 1} weight`} keyboardType="decimal-pad" style={styles.input} value={set.weight_kg?.toString() ?? ''} onChangeText={(value) => mutate((next) => { next.exercises[exerciseIndex].sets[setIndex].weight_kg = value ? Number(value) : null; })} /></View>
          <View style={styles.field}><Text style={styles.label}>reps</Text><TextInput accessibilityLabel={`${exercise.name} set ${setIndex + 1} reps`} keyboardType="number-pad" style={styles.input} value={String(set.reps)} onChangeText={(value) => mutate((next) => { next.exercises[exerciseIndex].sets[setIndex].reps = Math.max(1, Number(value) || 1); })} /></View>
          <View style={styles.field}><Text style={styles.label}>rest sec</Text><TextInput accessibilityLabel={`${exercise.name} set ${setIndex + 1} rest seconds`} keyboardType="number-pad" style={styles.input} value={String(set.rest_seconds ?? standardRestSeconds)} onChangeText={(value) => mutate((next) => { next.exercises[exerciseIndex].sets[setIndex].rest_seconds = Math.max(0, Number(value) || 0); })} /></View>
        </View>
        {exercise.sets.length > 1 ? <Button title="Remove set" color={colors.muted} onPress={() => mutate((next) => { next.exercises[exerciseIndex].sets.splice(setIndex, 1); })} /> : null}
      </View>)}
      <Button title="+ Add set" onPress={() => mutate((next) => { next.exercises[exerciseIndex].sets.push({ reps: 1, weight_kg: null, rest_seconds: standardRestSeconds }); })} />
      {plan.exercises.length > 1 ? <Button title="Remove exercise" color={colors.muted} onPress={() => mutate((next) => { next.exercises.splice(exerciseIndex, 1); })} /> : null}
    </View>)}
    <Button title="+ Add exercise" onPress={() => mutate((next) => { next.exercises.push({ client_id: `user-revision-${Date.now()}`, name: 'New exercise', sets: [{ reps: 1, weight_kg: null, rest_seconds: standardRestSeconds }] }); })} />
    <Button title={saving ? 'Saving…' : 'Save future workout'} color={colors.orange} disabled={saving} onPress={() => void save()} />
  </ScrollView>;
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.background }, content: { gap: spacing.md, padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl }, eyebrow: { color: colors.orange, fontWeight: '700' }, title: { color: colors.text, fontSize: 28, fontWeight: '700' }, message: { color: colors.muted, lineHeight: 20 }, card: { gap: spacing.sm, padding: spacing.md, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 14 }, set: { borderTopColor: colors.border, borderTopWidth: 1, gap: spacing.xs, paddingTop: spacing.sm }, row: { flexDirection: 'row', gap: spacing.xs }, field: { flex: 1, gap: 2 }, label: { color: colors.muted, fontSize: 12, fontWeight: '700' }, input: { minHeight: 44, borderColor: colors.border, borderWidth: 1, borderRadius: 8, color: colors.text, paddingHorizontal: spacing.sm } });
