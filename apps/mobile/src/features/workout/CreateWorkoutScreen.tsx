import { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button } from '@/components/Button';
import { NumberField } from '@/components/NumberField';
import { adjustReps, adjustWeight, formatWeightValue, parseRepsInput, parseWeightInput } from '@/components/numberFieldMath';
import { StatusCard } from '@/components/Screen';
import { getSupabaseClient } from '@/lib/supabase';
import { colors, radius, spacing } from '@/theme/tokens';

import { validatePlanRevision, type PlanRevisionIssue } from './planRevisionValidation';
import { createManualGymPlan, type GymPlan } from './workoutApi';

const standardRestSeconds = 120;

function todayLocalDate(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function blankPlan(scheduledFor: string): GymPlan {
  return {
    kind: 'gym_workout', schema_version: 1, scheduled_for: scheduledFor, title: '',
    exercises: [{ client_id: `manual-exercise-${Date.now()}`, name: '', sets: [{ reps: 1, weight_kg: null, rest_seconds: standardRestSeconds }] }],
  };
}

function issueFor(issues: PlanRevisionIssue[], path: string): string | undefined {
  return issues.find((issue) => issue.path === path)?.message;
}

export function CreateWorkoutScreen() {
  const router = useRouter();
  const [plan, setPlan] = useState<GymPlan>(() => blankPlan(todayLocalDate()));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const exerciseCounter = useRef(0);

  function mutate(change: (next: GymPlan) => void) {
    setPlan((current) => {
      const next = structuredClone(current);
      change(next);
      return next;
    });
  }

  const issues = useMemo(() => validatePlanRevision(plan), [plan]);
  const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(plan.scheduled_for) && plan.scheduled_for >= todayLocalDate();

  async function save() {
    const client = getSupabaseClient();
    if (!client || issues.length > 0 || !dateValid) return;
    setSaving(true);
    setSaveError(null);
    try {
      await createManualGymPlan(client, plan);
      router.back();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not create this workout.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <Text style={styles.eyebrow}>◇ CREATE WORKOUT · NO AGENT INVOLVED</Text>
      <Text style={styles.message}>Build a workout yourself. It becomes an active planned session as soon as you save it.</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Title</Text>
        <TextInput
          accessibilityLabel="Workout title" style={styles.input} editable={!saving}
          value={plan.title} onChangeText={(title) => mutate((next) => { next.title = title; })}
          placeholder="e.g. Push day" placeholderTextColor={colors.muted}
        />
        {issueFor(issues, 'title') ? <Text style={styles.fieldError}>{issueFor(issues, 'title')}</Text> : null}

        <Text style={styles.label}>Scheduled for</Text>
        <TextInput
          accessibilityLabel="Scheduled date" style={styles.input} editable={!saving}
          value={plan.scheduled_for} onChangeText={(date) => mutate((next) => { next.scheduled_for = date; })}
          placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted}
        />
        {!dateValid ? <Text style={styles.fieldError}>Date must be today or later, in YYYY-MM-DD form.</Text> : null}
      </View>

      {plan.exercises.map((exercise, exerciseIndex) => (
        <View key={exercise.client_id} style={styles.card}>
          <Text style={styles.label}>Exercise {exerciseIndex + 1}</Text>
          <TextInput
            accessibilityLabel={`Exercise ${exerciseIndex + 1} name`} style={styles.input} editable={!saving}
            value={exercise.name} placeholder="e.g. Bench press" placeholderTextColor={colors.muted}
            onChangeText={(name) => mutate((next) => { next.exercises[exerciseIndex].name = name; })}
          />
          {issueFor(issues, `exercises[${exerciseIndex}].name`) ? <Text style={styles.fieldError}>{issueFor(issues, `exercises[${exerciseIndex}].name`)}</Text> : null}

          {exercise.sets.map((set, setIndex) => (
            <View key={setIndex} style={styles.set}>
              <Text style={styles.label}>Set {setIndex + 1}</Text>
              <View style={styles.fieldsRow}>
                <NumberField
                  label="KG" value={formatWeightValue(set.weight_kg ?? null)} keyboardType="decimal-pad" disabled={saving}
                  accessibilityLabel={`Exercise ${exerciseIndex + 1} set ${setIndex + 1} kilograms`}
                  decrementLabel="Decrease weight by 2.5 kilograms" incrementLabel="Increase weight by 2.5 kilograms"
                  onChangeText={(text) => mutate((next) => { next.exercises[exerciseIndex].sets[setIndex].weight_kg = parseWeightInput(text); })}
                  onDecrement={() => mutate((next) => { next.exercises[exerciseIndex].sets[setIndex].weight_kg = adjustWeight(set.weight_kg ?? null, -2.5); })}
                  onIncrement={() => mutate((next) => { next.exercises[exerciseIndex].sets[setIndex].weight_kg = adjustWeight(set.weight_kg ?? null, 2.5); })}
                />
                <NumberField
                  label="REPS" value={String(set.reps)} keyboardType="number-pad" disabled={saving}
                  accessibilityLabel={`Exercise ${exerciseIndex + 1} set ${setIndex + 1} reps`}
                  decrementLabel="Decrease reps by 1" incrementLabel="Increase reps by 1"
                  onChangeText={(text) => mutate((next) => { next.exercises[exerciseIndex].sets[setIndex].reps = parseRepsInput(text, set.reps); })}
                  onDecrement={() => mutate((next) => { next.exercises[exerciseIndex].sets[setIndex].reps = adjustReps(set.reps, -1); })}
                  onIncrement={() => mutate((next) => { next.exercises[exerciseIndex].sets[setIndex].reps = adjustReps(set.reps, 1); })}
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
          exerciseCounter.current += 1;
          mutate((next) => { next.exercises.push({ client_id: `manual-exercise-${Date.now()}-${exerciseCounter.current}`, name: '', sets: [{ reps: 1, weight_kg: null, rest_seconds: standardRestSeconds }] }); });
        }}
      />

      {saveError ? <StatusCard tone="warning" title="Could not save" detail={saveError} /> : null}
      {issues.length > 0 ? <Text style={styles.fieldError}>Fix the highlighted fields before saving.</Text> : null}

      <Button
        label={saving ? 'Saving…' : 'Save workout'} variant="primary" fullWidth
        busy={saving} disabled={issues.length > 0 || !dateValid}
        onPress={() => void save()}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { gap: spacing.md, padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl },
  eyebrow: { color: colors.orange, fontWeight: '700' },
  message: { color: colors.muted, lineHeight: 20 },
  card: { backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, gap: spacing.sm, padding: spacing.md },
  set: { borderTopColor: colors.border, borderTopWidth: 1, gap: spacing.sm, paddingTop: spacing.sm },
  fieldsRow: { flexDirection: 'row', gap: spacing.md },
  label: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  input: { minHeight: 44, borderColor: colors.border, borderWidth: 1, borderRadius: radius.sm, color: colors.text, paddingHorizontal: spacing.sm },
  fieldError: { color: colors.danger, fontSize: 12, fontWeight: '700' },
});
