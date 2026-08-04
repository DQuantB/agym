import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';

import { Button } from '@/components/Button';
import { NumberField } from '@/components/NumberField';
import { adjustReps, adjustWeight, formatWeightValue, parseRepsInput, parseWeightInput } from '@/components/numberFieldMath';
import { StatusCard } from '@/components/Screen';
import { getSupabaseClient } from '@/lib/supabase';
import { colors, radius, spacing } from '@/theme/tokens';

import { validatePlanRevision, type PlanRevisionIssue } from './planRevisionValidation';
import { loadGymPlan, replaceFutureGymWorkoutPlan, type GymPlan } from './workoutApi';

const standardRestSeconds = 120;

function issueFor(issues: PlanRevisionIssue[], path: string): string | undefined {
  return issues.find((issue) => issue.path === path)?.message;
}

export function FuturePlanEditorScreen() {
  const navigation = useNavigation();
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const [plan, setPlan] = useState<GymPlan | null>(null);
  const originalPlanRef = useRef<GymPlan | null>(null);
  const [loadStatus, setLoadStatus] = useState<'loading' | 'error' | 'ready'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const newExerciseCounter = useRef(0);
  const newAlternativeCounter = useRef(0);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client || !planId) { setLoadStatus('error'); setLoadError('This scheduled workout is unavailable.'); return; }
    void loadGymPlan(client, planId).then((loaded) => {
      if (!loaded) { setLoadStatus('error'); setLoadError('This accepted Gym workout is unavailable.'); return; }
      setPlan(loaded);
      originalPlanRef.current = loaded;
      setLoadStatus('ready');
    }).catch((error: unknown) => {
      setLoadStatus('error');
      setLoadError(error instanceof Error ? error.message : 'Could not load scheduled workout.');
    });
  }, [planId]);

  const dirty = plan !== null && !saved && JSON.stringify(plan) !== JSON.stringify(originalPlanRef.current);

  useEffect(() => navigation.addListener('beforeRemove', (event) => {
    if (!dirty) return;
    event.preventDefault();
    Alert.alert('Discard changes?', 'Your edits to this future workout have not been saved.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(event.data.action) },
    ]);
  }), [navigation, dirty]);

  function mutate(change: (next: GymPlan) => void) {
    if (!plan) return;
    const next = structuredClone(plan);
    change(next);
    setPlan(next);
    setSaved(false);
  }

  const issues = useMemo(() => (plan ? validatePlanRevision(plan) : []), [plan]);

  async function save() {
    const client = getSupabaseClient();
    if (!client || !plan || !planId || issues.length > 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      await replaceFutureGymWorkoutPlan(client, planId, plan);
      originalPlanRef.current = plan;
      setSaved(true);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save this future workout.');
    } finally {
      setSaving(false);
    }
  }

  if (loadStatus === 'loading') return <View style={styles.centered}><StatusCard title="Loading scheduled workout" detail="Fetching your accepted future workout." /></View>;
  if (loadStatus === 'error' || !plan) return <View style={styles.centered}><StatusCard tone="warning" title="Scheduled workout unavailable" detail={loadError ?? 'This accepted Gym workout is unavailable.'} /></View>;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <Text style={styles.eyebrow}>◇ FUTURE WORKOUT · USER REVISION</Text>
      <Text style={styles.title}>{plan.title}</Text>
      <Text style={styles.message}>Adjust the future workout. The original agent plan remains preserved.</Text>

      {plan.exercises.map((exercise, exerciseIndex) => (
        <View key={exercise.client_id} style={styles.card}>
          <Text style={styles.label}>Exercise {exerciseIndex + 1}</Text>
          <TextInput
            accessibilityLabel={`Exercise ${exerciseIndex + 1} name`}
            style={styles.input}
            editable={!saving}
            value={exercise.name}
            onChangeText={(name) => mutate((next) => { next.exercises[exerciseIndex].name = name; })}
          />
          {issueFor(issues, `exercises[${exerciseIndex}].name`) ? <Text style={styles.fieldError}>{issueFor(issues, `exercises[${exerciseIndex}].name`)}</Text> : null}

          {(exercise.alternatives ?? []).map((alternative, alternativeIndex) => (
            <View key={alternative.client_id} style={styles.set}>
              <Text style={styles.label}>Alternative {alternativeIndex + 1}</Text>
              <TextInput
                accessibilityLabel={`Exercise ${exerciseIndex + 1} alternative ${alternativeIndex + 1} name`}
                style={styles.input}
                editable={!saving}
                value={alternative.name}
                onChangeText={(name) => mutate((next) => { next.exercises[exerciseIndex].alternatives![alternativeIndex].name = name; })}
              />
              {issueFor(issues, `exercises[${exerciseIndex}].alternatives[${alternativeIndex}].name`) ? <Text style={styles.fieldError}>{issueFor(issues, `exercises[${exerciseIndex}].alternatives[${alternativeIndex}].name`)}</Text> : null}
              <Button label="Remove alternative" variant="destructive" disabled={saving} onPress={() => mutate((next) => { next.exercises[exerciseIndex].alternatives!.splice(alternativeIndex, 1); })} />
            </View>
          ))}
          <Button
            label="+ Add alternative" variant="tertiary" disabled={saving}
            onPress={() => {
              newAlternativeCounter.current += 1;
              mutate((next) => {
                const target = next.exercises[exerciseIndex];
                target.alternatives = [...(target.alternatives ?? []), { client_id: `user-alt-${Date.now()}-${newAlternativeCounter.current}`, name: 'New option' }];
              });
            }}
          />

          {exercise.sets.map((set, setIndex) => (
            <View key={setIndex} style={styles.set}>
              <Text style={styles.label}>Set {setIndex + 1}</Text>
              <View style={styles.fieldsRow}>
                <NumberField
                  label="KG" value={formatWeightValue(set.weight_kg ?? null)} keyboardType="decimal-pad" disabled={saving}
                  accessibilityLabel={`${exercise.name} set ${setIndex + 1} kilograms`}
                  decrementLabel="Decrease weight by 2.5 kilograms" incrementLabel="Increase weight by 2.5 kilograms"
                  onChangeText={(text) => mutate((next) => { next.exercises[exerciseIndex].sets[setIndex].weight_kg = parseWeightInput(text); })}
                  onDecrement={() => mutate((next) => { next.exercises[exerciseIndex].sets[setIndex].weight_kg = adjustWeight(set.weight_kg ?? null, -2.5); })}
                  onIncrement={() => mutate((next) => { next.exercises[exerciseIndex].sets[setIndex].weight_kg = adjustWeight(set.weight_kg ?? null, 2.5); })}
                />
                <NumberField
                  label="REPS" value={String(set.reps)} keyboardType="number-pad" disabled={saving}
                  accessibilityLabel={`${exercise.name} set ${setIndex + 1} reps`}
                  decrementLabel="Decrease reps by 1" incrementLabel="Increase reps by 1"
                  onChangeText={(text) => mutate((next) => { next.exercises[exerciseIndex].sets[setIndex].reps = parseRepsInput(text, set.reps); })}
                  onDecrement={() => mutate((next) => { next.exercises[exerciseIndex].sets[setIndex].reps = adjustReps(set.reps, -1); })}
                  onIncrement={() => mutate((next) => { next.exercises[exerciseIndex].sets[setIndex].reps = adjustReps(set.reps, 1); })}
                />
              </View>
              <View style={styles.restRow}>
                <Text style={styles.restLabel}>REST SEC</Text>
                <TextInput
                  accessibilityLabel={`${exercise.name} set ${setIndex + 1} rest seconds`}
                  keyboardType="number-pad" style={styles.restInput} editable={!saving}
                  value={String(set.rest_seconds ?? standardRestSeconds)}
                  onChangeText={(value) => mutate((next) => { next.exercises[exerciseIndex].sets[setIndex].rest_seconds = Math.max(0, Math.round(Number(value)) || 0); })}
                />
              </View>
              {issueFor(issues, `exercises[${exerciseIndex}].sets[${setIndex}].reps`) ? <Text style={styles.fieldError}>{issueFor(issues, `exercises[${exerciseIndex}].sets[${setIndex}].reps`)}</Text> : null}
              {issueFor(issues, `exercises[${exerciseIndex}].sets[${setIndex}].weight_kg`) ? <Text style={styles.fieldError}>{issueFor(issues, `exercises[${exerciseIndex}].sets[${setIndex}].weight_kg`)}</Text> : null}
              {exercise.sets.length > 1 ? (
                <Button label="Remove set" variant="destructive" disabled={saving} onPress={() => mutate((next) => { next.exercises[exerciseIndex].sets.splice(setIndex, 1); })} />
              ) : null}
            </View>
          ))}

          <Button label="+ Add set" variant="tertiary" disabled={saving} onPress={() => mutate((next) => { next.exercises[exerciseIndex].sets.push({ reps: 1, weight_kg: null, rest_seconds: standardRestSeconds }); })} />
          {plan.exercises.length > 1 ? (
            <Button label="Remove exercise" variant="destructive" disabled={saving} onPress={() => mutate((next) => { next.exercises.splice(exerciseIndex, 1); })} />
          ) : null}
        </View>
      ))}

      <Button
        label="+ Add exercise" variant="secondary" fullWidth disabled={saving}
        onPress={() => {
          newExerciseCounter.current += 1;
          mutate((next) => { next.exercises.push({ client_id: `user-revision-${Date.now()}-${newExerciseCounter.current}`, name: 'New exercise', sets: [{ reps: 1, weight_kg: null, rest_seconds: standardRestSeconds }] }); });
        }}
      />

      {saveError ? <StatusCard tone="warning" title="Could not save" detail={saveError} /> : null}
      {saved ? <StatusCard tone="confirmed" title="Future workout saved" detail="Your adjustment is saved. The original agent plan remains available as the baseline." /> : null}
      {issues.length > 0 ? <Text style={styles.fieldError}>Fix the highlighted fields before saving.</Text> : null}

      <Button
        label={saving ? 'Saving…' : 'Save future workout'} variant="primary" fullWidth
        busy={saving} disabled={issues.length > 0 || !dirty}
        onPress={() => void save()}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: { alignItems: 'center', backgroundColor: colors.background, flex: 1, justifyContent: 'center', padding: spacing.lg },
  content: { gap: spacing.md, padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl },
  eyebrow: { color: colors.orange, fontWeight: '700' },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  message: { color: colors.muted, lineHeight: 20 },
  card: { backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, gap: spacing.sm, padding: spacing.md },
  set: { borderTopColor: colors.border, borderTopWidth: 1, gap: spacing.sm, paddingTop: spacing.sm },
  fieldsRow: { flexDirection: 'row', gap: spacing.md },
  label: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  input: { minHeight: 44, borderColor: colors.border, borderWidth: 1, borderRadius: radius.sm, color: colors.text, paddingHorizontal: spacing.sm },
  restRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  restLabel: { color: colors.muted, fontWeight: '700', fontSize: 12, letterSpacing: 1 },
  restInput: { minHeight: 44, width: 88, borderColor: colors.border, borderWidth: 1, borderRadius: radius.sm, color: colors.text, paddingHorizontal: spacing.sm, textAlign: 'center' },
  fieldError: { color: colors.danger, fontSize: 12, fontWeight: '700' },
});
