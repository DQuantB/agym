import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Alert, Button, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { getSupabaseClient } from '@/lib/supabase';
import { colors, spacing } from '@/theme/tokens';

import { executionEditorReducer, type ExecutionEditorState } from './executionEditorReducer';
import { deferCurrentExercise, getCurrentWorkoutSet, repairFocusedWorkoutSession, setRestEnd, type FocusedWorkoutSession } from './focusedWorkoutSession';
import { deleteLocalExecutionDraft, loadLocalExecutionDraft, saveLocalExecutionDraft, type LocalSyncState } from './localDraftStore';
import { RestTimer } from './RestTimer';
import { actualFromPlan, confirmRemoteExecution, loadActiveWorkout, startRemoteExecution, syncRemoteExecution, type GymPlan } from './workoutApi';

type Loaded = { planId: string; plan: GymPlan; executionId: string | null };

function localDate() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export function WorkoutExecutionScreen() {
  const auth = useAuth();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [editor, dispatch] = useReducer(executionEditorReducer, { actualData: { kind: 'gym_workout_execution', schema_version: 1, exercises: [] }, additionalNotes: '' });
  const [session, setSession] = useState<FocusedWorkoutSession>({ exerciseOrder: [], restEndsAt: null });
  const [message, setMessage] = useState('Loading accepted workout…');
  const editorRef = useRef(editor);
  const sessionRef = useRef(session);
  const lastAutoSavedSnapshotRef = useRef<string | null>(null);
  editorRef.current = editor;
  sessionRef.current = session;

  const saveDraft = useCallback(async (
    state: ExecutionEditorState,
    focusedSession: FocusedWorkoutSession,
    stateForDraft: LocalSyncState = 'saved_locally',
    lastSyncError: string | null = null,
  ) => {
    if (!loaded || !auth.session) return;
    await saveLocalExecutionDraft({
      userId: auth.session.user.id,
      planId: loaded.planId,
      executionId: loaded.executionId,
      plannedSnapshot: loaded.plan,
      actualData: state.actualData,
      additionalNotes: state.additionalNotes,
      session: focusedSession,
      syncState: stateForDraft,
      lastSyncError,
      updatedAt: new Date().toISOString(),
    });
  }, [auth.session, loaded]);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client || !auth.session) return;
    const userId = auth.session.user.id;
    let active = true;
    void loadActiveWorkout(client, localDate()).then(async (remote) => {
      if (!active) return;
      if (!remote) {
        setMessage('No accepted Gym workout is scheduled for today.');
        return;
      }
      if (remote.execution?.status === 'completed') {
        setMessage('This workout is already user confirmed and immutable.');
        return;
      }
      const local = await loadLocalExecutionDraft(userId, remote.planId);
      if (!active) return;
      const initial = (local?.actualData ?? remote.execution?.executionData ?? actualFromPlan(remote.plan)) as ExecutionEditorState['actualData'];
      const notes = local?.additionalNotes ?? remote.execution?.additionalNotes ?? '';
      setLoaded({ planId: remote.planId, plan: remote.plan, executionId: local?.executionId ?? remote.execution?.id ?? null });
      dispatch({ type: 'hydrate', state: { actualData: initial, additionalNotes: notes } });
      setSession(repairFocusedWorkoutSession(initial, local?.session));

      setMessage('');
    }).catch((error: unknown) => {
      if (active) setMessage(error instanceof Error ? error.message : 'Could not load workout.');
    });
    return () => { active = false; };
  }, [auth.session]);

  useEffect(() => {
    if (!loaded || !auth.session) return;
    const snapshot = JSON.stringify({ editor, session });
    if (lastAutoSavedSnapshotRef.current === snapshot) return;
    void saveDraft(editor, session).then(() => {
      lastAutoSavedSnapshotRef.current = snapshot;

    }).catch(() => setMessage('Could not save this workout locally. Keep this screen open and retry.'));
  }, [auth.session, editor, loaded, saveDraft, session]);

  async function sync(): Promise<string | null> {
    const client = getSupabaseClient();
    if (!loaded || !auth.session || !client) return null;
    const snapshot = editorRef.current;
    const sessionSnapshot = sessionRef.current;
    try {

      await saveDraft(snapshot, sessionSnapshot, 'syncing');
      const executionId = loaded.executionId ?? await startRemoteExecution(client, auth.session.user.id, loaded.planId, loaded.plan, snapshot.actualData);
      await syncRemoteExecution(client, executionId, snapshot.actualData, snapshot.additionalNotes);
      setLoaded((current) => current ? { ...current, executionId } : current);
      await saveLocalExecutionDraft({
        userId: auth.session.user.id,
        planId: loaded.planId,
        executionId,
        plannedSnapshot: loaded.plan,
        actualData: snapshot.actualData,
        additionalNotes: snapshot.additionalNotes,
        session: sessionSnapshot,
        syncState: 'synced',
        lastSyncError: null,
        updatedAt: new Date().toISOString(),
      });

      return executionId;
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Sync failed.';
      await saveDraft(snapshot, sessionSnapshot, 'sync_failed', detail).catch(() => undefined);

      setMessage(`${detail} Your local draft remains saved.`);
      return null;
    }
  }

  function reviewAndConfirm() {
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
      setLoaded(null);
      setMessage('✓ User confirmed. The outcome is now immutable history.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not confirm workout. Your synced draft remains available.');
    }
  }

  if (!loaded) return <View style={styles.screen}><Text style={styles.message}>{message}</Text></View>;

  const current = getCurrentWorkoutSet(editor.actualData, session);
  if (!current) {
    return <View style={styles.screen}><View style={styles.completeCard}><Text style={styles.eyebrow}>WORKOUT COMPLETE</Text><Text style={styles.title}>All sets are recorded.</Text><Text style={styles.message}>Your actual workout is saved locally. Review it before confirming immutable history.</Text><Button title="Finish — review actual" color={colors.orange} onPress={reviewAndConfirm} /></View></View>;
  }

  const exercise = editor.actualData.exercises[current.exerciseIndex];
  const set = exercise.sets[current.setIndex];
  const restIsActive = session.restEndsAt !== null && session.restEndsAt > Date.now();

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text style={styles.eyebrow}>CURRENT EXERCISE</Text>
    <Text style={styles.exercise}>{exercise.name}</Text>
    <Text style={styles.setLabel}>Set {current.setIndex + 1} of {exercise.sets.length}</Text>
    {restIsActive ? <RestTimer endsAt={session.restEndsAt} onAddTime={() => setSession((value) => setRestEnd(value, (value.restEndsAt ?? Date.now()) + 30_000))} onDismiss={() => setSession((value) => setRestEnd(value, null))} /> : null}
    <View style={styles.card}>
      <Text style={styles.fieldLabel}>Weight (kg)</Text>
      <TextInput accessibilityLabel={`${exercise.name} set ${current.setIndex + 1} kilograms`} keyboardType="decimal-pad" style={styles.input} value={set.weight_kg?.toString() ?? ''} onChangeText={(text) => dispatch({ type: 'set_weight', exerciseIndex: current.exerciseIndex, setIndex: current.setIndex, weightKg: text === '' ? null : Number(text) })} />
      <Text style={styles.fieldLabel}>Reps</Text>
      <TextInput accessibilityLabel={`${exercise.name} set ${current.setIndex + 1} reps`} keyboardType="number-pad" style={styles.input} value={String(set.reps)} onChangeText={(text) => dispatch({ type: 'set_reps', exerciseIndex: current.exerciseIndex, setIndex: current.setIndex, reps: Number(text) })} />
    </View>
    <View style={styles.actions}>
      <Button title="Complete set" onPress={() => {
        dispatch({ type: 'complete_set', exerciseIndex: current.exerciseIndex, setIndex: current.setIndex });
        setSession((value) => setRestEnd(value, Date.now() + set.rest_seconds * 1_000));
      }} />
      <Button title={`Move ${exercise.name} to later`} onPress={() => setSession((value) => deferCurrentExercise(editor.actualData, value))} />
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, justifyContent: 'center' },
  content: { paddingVertical: spacing.xl, gap: spacing.md },
  eyebrow: { color: colors.orange, fontWeight: '700', letterSpacing: 1 },
  exercise: { color: colors.text, fontSize: 30, fontWeight: '700' },
  setLabel: { color: colors.muted, fontSize: 18 },
  card: { gap: spacing.xs, padding: spacing.md, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 14 },
  fieldLabel: { color: colors.muted, fontWeight: '700', marginTop: spacing.xs },
  input: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: 8, borderColor: colors.border, borderWidth: 1, color: colors.text, fontSize: 20 },
  actions: { gap: spacing.sm },
  completeCard: { gap: spacing.md },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  message: { color: colors.muted, lineHeight: 20 },
});
