import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Alert, Button, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useAuth } from '@/auth/AuthProvider';
import { ExercisePicker } from '@/features/exercises/ExercisePicker';
import { getSupabaseClient } from '@/lib/supabase';
import { colors, spacing } from '@/theme/tokens';

import { executionEditorReducer, type ExecutionEditorState } from './executionEditorReducer';
import { deleteLocalExecutionDraft, loadLocalExecutionDraft, saveLocalExecutionDraft, type LocalSyncState } from './localDraftStore';
import { RestTimer } from './RestTimer';
import { actualFromPlan, confirmRemoteExecution, loadActiveWorkout, startRemoteExecution, syncRemoteExecution, type GymPlan } from './workoutApi';

type Loaded = { planId: string; plan: GymPlan; executionId: string | null };
function localDate() { const now = new Date(); return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10); }
function setKey(exerciseIndex: number, setIndex: number) { return `${exerciseIndex}:${setIndex}`; }

export function WorkoutExecutionScreen() {
  const router = useRouter();
  const auth = useAuth();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [editor, dispatch] = useReducer(executionEditorReducer, { actualData: { kind: 'gym_workout_execution', schema_version: 1, exercises: [] }, additionalNotes: '' });
  const [syncState, setSyncState] = useState<LocalSyncState>('saved_locally');
  const [message, setMessage] = useState('Loading accepted workout…');
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [skipReasons, setSkipReasons] = useState<Record<string, string>>({});
  const [pickerVisible, setPickerVisible] = useState(false);
  const editorRef = useRef(editor);
  const lastAutoSavedEditorRef = useRef<ExecutionEditorState | null>(null);
  editorRef.current = editor;

  const saveDraft = useCallback(async (state: ExecutionEditorState, stateForDraft: LocalSyncState = 'saved_locally', lastSyncError: string | null = null) => {
    if (!loaded || !auth.session) return;
    await saveLocalExecutionDraft({ userId: auth.session.user.id, planId: loaded.planId, executionId: loaded.executionId, plannedSnapshot: loaded.plan, actualData: state.actualData, additionalNotes: state.additionalNotes, syncState: stateForDraft, lastSyncError, updatedAt: new Date().toISOString() });
  }, [auth.session, loaded]);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client || !auth.session) return;
    let active = true;
    void loadActiveWorkout(client, localDate()).then(async (remote) => {
      if (!active) return;
      if (!remote) { setMessage('No accepted Gym workout is scheduled for today.'); return; }
      if (remote.execution?.status === 'completed') { setMessage('This workout is already user confirmed and immutable.'); return; }
      const local = await loadLocalExecutionDraft(auth.session!.user.id, remote.planId);
      if (!active) return;
      const initial = local?.actualData ?? remote.execution?.executionData ?? actualFromPlan(remote.plan);
      const notes = local?.additionalNotes ?? remote.execution?.additionalNotes ?? '';
      setLoaded({ planId: remote.planId, plan: remote.plan, executionId: local?.executionId ?? remote.execution?.id ?? null });
      dispatch({ type: 'hydrate', state: { actualData: initial as ExecutionEditorState['actualData'], additionalNotes: notes } });
      setSyncState(local?.syncState ?? (remote.execution ? 'synced' : 'saved_locally'));
      setMessage(local ? 'Saved local draft restored. It is not confirmed yet.' : 'Edit what actually happened. The planned session stays unchanged.');
    }).catch((error: unknown) => { if (active) setMessage(error instanceof Error ? error.message : 'Could not load workout.'); });
    return () => { active = false; };
  }, [auth.session]);

  // The reducer has committed before this effect runs, so every edit is persisted as the new value, not the prior render's value.
  useEffect(() => {
    if (!loaded || !auth.session || lastAutoSavedEditorRef.current === editor) return;
    void saveDraft(editor).then(() => {
      lastAutoSavedEditorRef.current = editor;
      setSyncState('saved_locally');
    }).catch(() => setMessage('Could not save this edit locally. Keep this screen open and retry.'));
  }, [auth.session, editor, loaded, saveDraft]);

  async function sync(): Promise<string | null> {
    const client = getSupabaseClient();
    if (!loaded || !auth.session || !client) return null;
    const snapshot = editorRef.current;
    try {
      setSyncState('syncing');
      await saveDraft(snapshot, 'syncing');
      const executionId = loaded.executionId ?? await startRemoteExecution(client, auth.session.user.id, loaded.planId, loaded.plan, snapshot.actualData);
      await syncRemoteExecution(client, executionId, snapshot.actualData, snapshot.additionalNotes);
      setLoaded((current) => current ? { ...current, executionId } : current);
      await saveLocalExecutionDraft({ userId: auth.session.user.id, planId: loaded.planId, executionId, plannedSnapshot: loaded.plan, actualData: snapshot.actualData, additionalNotes: snapshot.additionalNotes, syncState: 'synced', lastSyncError: null, updatedAt: new Date().toISOString() });
      setSyncState('synced');
      setMessage('Synced. Review the actual session before confirming it as immutable history.');
      return executionId;
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Sync failed.';
      await saveDraft(snapshot, 'sync_failed', detail).catch(() => undefined);
      setSyncState('sync_failed');
      setMessage(`${detail} Your local draft remains saved.`);
      return null;
    }
  }

  function reviewAndConfirm() {
    if (!loaded) return;
    const sets = editorRef.current.actualData.exercises.flatMap((exercise) => exercise.sets);
    const completed = sets.filter((set) => set.completed).length;
    const skipped = sets.filter((set) => set.skipped_reason).length;
    Alert.alert('Review actual session', `${completed} completed set${completed === 1 ? '' : 's'} · ${skipped} skipped with a reason.\n\nThe planned workout stays unchanged. Confirming creates immutable user-confirmed history.`, [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Confirm session', style: 'destructive', onPress: () => void confirm() },
    ]);
  }

  async function confirm() {
    const client = getSupabaseClient();
    if (!loaded || !auth.session || !client) return;
    const executionId = await sync();
    if (!executionId) return;
    try {
      await confirmRemoteExecution(client, executionId);
      await deleteLocalExecutionDraft(auth.session.user.id, loaded.planId);
      router.replace('/(tabs)/log' as never);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not confirm workout. Your synced draft remains available.');
    }
  }

  if (!loaded) return <View style={styles.screen}><Text style={styles.message}>{message}</Text></View>;
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text style={styles.eyebrow}>◇ IMMUTABLE PLAN · EDITABLE ACTUAL</Text><Text style={styles.title}>{loaded.plan.title}</Text><Text style={styles.message}>{message}</Text>
    <RestTimer endsAt={restEndsAt} onAddTime={() => setRestEndsAt((value) => (value ?? Date.now()) + 30_000)} onDismiss={() => setRestEndsAt(null)} />
    {editor.actualData.exercises.map((exercise, exerciseIndex) => <View key={exercise.client_id} style={styles.card}>{exercise.user_added ? <View style={styles.field}><Text style={styles.fieldLabel}>Exercise name</Text><TextInput accessibilityLabel={`Actual exercise ${exerciseIndex + 1} name`} style={styles.input} value={exercise.name} onChangeText={(name) => dispatch({ type: 'set_exercise_name', exerciseIndex, name })} onEndEditing={(event) => dispatch({ type: 'set_exercise_name', exerciseIndex, name: event.nativeEvent.text })} /></View> : <Text style={styles.exercise}>{exercise.name}</Text>}{exercise.sets.map((set, setIndex) => {
      const key = setKey(exerciseIndex, setIndex);
      return <View key={`${exercise.client_id}-${setIndex}`} style={styles.set}><Text style={styles.setTitle}>Set {setIndex + 1}{set.user_added ? ' · added' : ''}</Text><Text style={styles.message}>Rest after completion: {set.rest_seconds}s</Text><View style={styles.measurements}><View style={styles.field}><Text style={styles.fieldLabel}>Weight (kg)</Text><TextInput accessibilityLabel={`${exercise.name} set ${setIndex + 1} kilograms`} keyboardType="decimal-pad" style={styles.input} value={set.weight_kg?.toString() ?? ''} onChangeText={(text) => dispatch({ type: 'set_weight', exerciseIndex, setIndex, weightKg: text === '' ? null : Number(text) })} /></View><View style={styles.field}><Text style={styles.fieldLabel}>Reps</Text><TextInput accessibilityLabel={`${exercise.name} set ${setIndex + 1} reps`} keyboardType="number-pad" style={styles.input} value={String(set.reps)} onChangeText={(text) => dispatch({ type: 'set_reps', exerciseIndex, setIndex, reps: Number(text) })} /></View></View>
      {set.skipped_reason ? <Text style={styles.skipped}>Skipped: {set.skipped_reason}</Text> : <><Button title={set.completed ? 'Set complete ✓' : 'Complete set'} color={colors.green} onPress={() => { dispatch({ type: 'toggle_set', exerciseIndex, setIndex }); if (!set.completed) setRestEndsAt(Date.now() + set.rest_seconds * 1_000); }} /><View style={styles.field}><Text style={styles.fieldLabel}>Or skip this set (reason required)</Text><TextInput accessibilityLabel={`${exercise.name} set ${setIndex + 1} skipped reason`} style={styles.input} placeholder="Why was it skipped?" placeholderTextColor={colors.muted} value={skipReasons[key] ?? ''} onChangeText={(reason) => setSkipReasons((current) => ({ ...current, [key]: reason }))} /></View><Button title="Skip set" color={colors.muted} disabled={!skipReasons[key]?.trim()} onPress={() => dispatch({ type: 'skip_set', exerciseIndex, setIndex, reason: skipReasons[key] })} /></>}
      </View>;
    })}<Button title="+ Add actual set" onPress={() => dispatch({ type: 'add_set', exerciseIndex })} /></View>)}
    <Button title="+ Add actual exercise" onPress={() => setPickerVisible(true)} />
    <ExercisePicker
      visible={pickerVisible}
      onClose={() => setPickerVisible(false)}
      onAddManually={() => { setPickerVisible(false); dispatch({ type: 'add_exercise' }); }}
      onSelect={(exercise) => { setPickerVisible(false); dispatch({ type: 'add_catalogue_exercise', name: exercise.name, catalogueExerciseId: exercise.id }); }}
    />
    <TextInput accessibilityLabel="Additional notes" multiline style={[styles.input, styles.notes]} placeholder="What changed or felt notable?" placeholderTextColor={colors.muted} value={editor.additionalNotes} onChangeText={(notes) => dispatch({ type: 'set_notes', notes })} />
    <View style={styles.finishCard}><Text style={styles.finishTitle}>Ready to finish?</Text><Text style={styles.message}>Your planned workout remains unchanged. Review your actual sets before creating immutable history.</Text><Text style={styles.message}>Local status: {syncState.replace('_', ' ')}</Text><Button title="Sync saved draft" onPress={() => void sync()} /><Button title="Review & confirm workout" color={colors.orange} onPress={reviewAndConfirm} /></View>
  </ScrollView>;
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.background }, content: { padding: spacing.lg, paddingTop: 64, paddingBottom: spacing.xl, gap: spacing.md }, eyebrow: { color: colors.orange, fontWeight: '700' }, title: { color: colors.text, fontSize: 28, fontWeight: '700' }, message: { color: colors.muted, lineHeight: 20 }, card: { gap: spacing.sm, padding: spacing.md, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 14 }, exercise: { color: colors.text, fontSize: 18, fontWeight: '700' }, set: { gap: spacing.xs, borderTopColor: colors.border, borderTopWidth: 1, paddingTop: spacing.sm }, setTitle: { color: colors.text, fontSize: 16, fontWeight: '700' }, measurements: { flexDirection: 'row', gap: spacing.sm }, field: { flex: 1, gap: 4 }, fieldLabel: { color: colors.muted, fontSize: 12, fontWeight: '700' }, input: { minHeight: 44, paddingHorizontal: spacing.sm, borderRadius: 8, borderColor: colors.border, borderWidth: 1, color: colors.text }, notes: { minHeight: 110, textAlignVertical: 'top' }, skipped: { color: colors.orange, fontStyle: 'italic' }, finishCard: { gap: spacing.sm, padding: spacing.md, backgroundColor: colors.surface, borderColor: colors.orange, borderWidth: 1, borderRadius: 14 }, finishTitle: { color: colors.text, fontSize: 18, fontWeight: '700' } });
