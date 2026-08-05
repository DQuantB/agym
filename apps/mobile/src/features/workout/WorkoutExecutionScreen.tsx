import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { NumberField } from '@/components/NumberField';
import { adjustReps, adjustWeight, formatWeightValue, parseRepsInput, parseWeightInput } from '@/components/numberFieldMath';
import { StatusCard } from '@/components/Screen';
import { ExercisePicker } from '@/features/exercises/ExercisePicker';
import { getSupabaseClient } from '@/lib/supabase';
import { colors, hit, radius, spacing, type } from '@/theme/tokens';

import { executionEditorReducer, type ExecutionEditorState } from './executionEditorReducer';
import {
  canDeferCurrentExercise, deferCurrentExercise, getCurrentWorkoutSet, repairFocusedWorkoutSession, setRestEnd,
  type FocusedWorkoutSession,
} from './focusedWorkoutSession';
import { deleteLocalExecutionDraft, loadLocalExecutionDraft, saveLocalExecutionDraft, type LocalSyncState } from './localDraftStore';
import { findPlannedExercise, findPlannedSet, formatPlannedDelta } from './plannedReference';
import { PlannedReferenceRow } from './PlannedReferenceRow';
import { RestTimer } from './RestTimer';
import { SyncBadge } from './SyncBadge';
import { actualFromPlan, confirmRemoteExecution, loadActiveWorkout, startRemoteExecution, syncRemoteExecution, type GymPlan } from './workoutApi';
import { computeWorkoutProgress, formatDuration, formatVolumeKg, sessionVolume } from './workoutMetrics';
import { WorkoutProgressBar } from './WorkoutProgressBar';

type Loaded = { planId: string; plan: GymPlan; executionId: string | null };

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'no_plan' }
  | { kind: 'completed' }
  | { kind: 'ready' };

function localDate() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export function WorkoutExecutionScreen() {
  const router = useRouter();
  const auth = useAuth();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [editor, dispatch] = useReducer(executionEditorReducer, { actualData: { kind: 'gym_workout_execution', schema_version: 1, exercises: [] }, additionalNotes: '' });
  const [session, setSession] = useState<FocusedWorkoutSession>({ exerciseOrder: [], restEndsAt: null });
  const [loadState, setLoadState] = useState<LoadState>({ kind: 'loading' });
  const [reloadToken, setReloadToken] = useState(0);
  const [message, setMessage] = useState('');
  const [skipExpanded, setSkipExpanded] = useState(false);
  const [skipReason, setSkipReason] = useState('');
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [syncState, setSyncState] = useState<LocalSyncState>('saved_locally');
  const [syncError, setSyncError] = useState<string | null>(null);
  const editorRef = useRef(editor);
  const sessionRef = useRef(session);
  const lastAutoSavedSnapshotRef = useRef<string | null>(null);
  const startedAtRef = useRef<string>(new Date().toISOString());
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
    setLoadState({ kind: 'loading' });
    const client = getSupabaseClient();
    if (!client || !auth.session) {
      setLoadState({ kind: 'error', message: 'This device has no public AGYM data connection yet.' });
      return;
    }
    const userId = auth.session.user.id;
    let active = true;
    void loadActiveWorkout(client, localDate()).then(async (remote) => {
      if (!active) return;
      if (!remote) {
        setLoadState({ kind: 'no_plan' });
        return;
      }
      if (remote.execution?.status === 'completed') {
        setLoadState({ kind: 'completed' });
        return;
      }
      const local = await loadLocalExecutionDraft(userId, remote.planId);
      if (!active) return;
      const initial = (local?.actualData ?? remote.execution?.executionData ?? actualFromPlan(remote.plan)) as ExecutionEditorState['actualData'];
      const notes = local?.additionalNotes ?? remote.execution?.additionalNotes ?? '';
      setLoaded({ planId: remote.planId, plan: remote.plan, executionId: local?.executionId ?? remote.execution?.id ?? null });
      dispatch({ type: 'hydrate', state: { actualData: initial, additionalNotes: notes } });
      setSession(repairFocusedWorkoutSession(initial, local?.session));
      setSyncState(local?.syncState ?? 'saved_locally');
      setSyncError(local?.lastSyncError ?? null);

      setLoadState({ kind: 'ready' });
    }).catch((error: unknown) => {
      if (active) setLoadState({ kind: 'error', message: error instanceof Error ? error.message : 'Could not load workout.' });
    });
    return () => { active = false; };
  }, [auth.session, reloadToken]);

  useEffect(() => {
    if (!loaded || !auth.session) return;
    const snapshot = JSON.stringify({ editor, session });
    if (lastAutoSavedSnapshotRef.current === snapshot) return;
    void saveDraft(editor, session).then(() => {
      lastAutoSavedSnapshotRef.current = snapshot;
      setSyncState((current) => (current === 'syncing' ? current : 'saved_locally'));
    }).catch(() => setMessage('Could not save this workout locally. Keep this screen open and retry.'));
  }, [auth.session, editor, loaded, saveDraft, session]);

  async function sync(): Promise<string | null> {
    const client = getSupabaseClient();
    if (!loaded || !auth.session || !client) return null;
    const snapshot = editorRef.current;
    const sessionSnapshot = sessionRef.current;
    setSyncState('syncing');
    setSyncError(null);
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
      setSyncState('synced');
      return executionId;
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Sync failed.';
      await saveDraft(snapshot, sessionSnapshot, 'sync_failed', detail).catch(() => undefined);
      setSyncState('sync_failed');
      setSyncError(detail);
      setMessage(`${detail} Your local draft remains saved.`);
      return null;
    }
  }

  function reviewAndConfirm() {
    const progress = computeWorkoutProgress(editorRef.current.actualData);
    Alert.alert('Review actual session', `${progress.completedSets} completed set${progress.completedSets === 1 ? '' : 's'} · ${progress.skippedSets} skipped with a reason.\n\nThe planned workout stays unchanged. Confirming creates immutable user-confirmed history.`, [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Confirm session', onPress: () => void confirm() },
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

  if (!loaded) return (
    <View style={styles.screen}>
      <View style={styles.statusStack}>
        {loadState.kind === 'loading' ? (
          <StatusCard busy title="Loading workout" detail="Checking today's accepted Gym workout and any saved local progress." />
        ) : null}
        {loadState.kind === 'error' ? (
          <>
            <StatusCard tone="warning" title="Could not load workout" detail={loadState.message} />
            <Button label="Retry" variant="secondary" fullWidth onPress={() => setReloadToken((token) => token + 1)} />
          </>
        ) : null}
        {loadState.kind === 'no_plan' ? (
          <>
            <StatusCard title="No workout today" detail="No accepted Gym workout is scheduled for today." />
            <Button label="+ Create workout" variant="secondary" fullWidth onPress={() => router.replace({ pathname: '/workout', params: { mode: 'create' } } as never)} />
          </>
        ) : null}
        {loadState.kind === 'completed' ? (
          <>
            <StatusCard tone="confirmed" title="✓ Already confirmed" detail="This workout is user confirmed and immutable." />
            <Button label="View in history" variant="secondary" fullWidth onPress={() => router.replace('/(tabs)/log' as never)} />
          </>
        ) : null}
      </View>
    </View>
  );

  const current = getCurrentWorkoutSet(editor.actualData, session);
  const progress = computeWorkoutProgress(editor.actualData);

  if (!current) {
    const volume = sessionVolume(editor.actualData);
    const duration = formatDuration(startedAtRef.current, new Date().toISOString());
    return <View style={styles.screen}>
      <View style={styles.completeCard}>
        <Text style={styles.eyebrow}>WORKOUT COMPLETE</Text>
        <Text style={styles.title}>All sets are recorded.</Text>
        <View style={styles.summaryRow}>
          {duration ? <View style={styles.summaryMetric}><Text style={styles.summaryValue}>{duration}</Text><Text style={styles.summaryLabel}>duration</Text></View> : null}
          <View style={styles.summaryMetric}><Text style={styles.summaryValue}>{progress.completedSets}/{progress.totalSets}</Text><Text style={styles.summaryLabel}>{progress.skippedSets} skipped</Text></View>
          <View style={styles.summaryMetric}><Text style={styles.summaryValue}>{formatVolumeKg(volume.kg)}</Text><Text style={styles.summaryLabel}>{volume.bodyweightSets > 0 ? `${volume.bodyweightSets} bodyweight excluded` : 'load volume'}</Text></View>
        </View>
        <Text style={styles.message}>Your actual workout is saved locally. Review it before confirming immutable history.</Text>
        <Button label="FINISH — REVIEW ACTUAL" variant="primary" fullWidth accessibilityLabel="Finish and review actual session" onPress={reviewAndConfirm} />
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    </View>;
  }

  const exercise = editor.actualData.exercises[current.exerciseIndex];
  const set = exercise.sets[current.setIndex];
  const restIsActive = session.restEndsAt !== null && session.restEndsAt > Date.now();
  const plannedRef = findPlannedSet(loaded.plan, exercise, current.setIndex);
  const plannedDelta = formatPlannedDelta(plannedRef, set);
  const canDefer = canDeferCurrentExercise(editor.actualData, session);
  const plannedExercise = findPlannedExercise(loaded.plan, exercise);
  const exerciseOptions = plannedExercise?.alternatives?.length
    ? [{ client_id: plannedExercise.client_id, name: plannedExercise.name, catalogue_exercise_id: undefined as string | undefined }, ...plannedExercise.alternatives]
    : null;

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
    <View style={styles.topBar}>
      <Text style={styles.planTitle} numberOfLines={1}>{loaded.plan.title}</Text>
      <SyncBadge state={syncState} lastSyncError={syncError} onRetry={() => void sync()} />
    </View>
    <WorkoutProgressBar progress={progress} exerciseIndex={current.exerciseIndex} />

    {restIsActive ? <RestTimer endsAt={session.restEndsAt} onAddTime={() => setSession((value) => setRestEnd(value, (value.restEndsAt ?? Date.now()) + 30_000))} onDismiss={() => setSession((value) => setRestEnd(value, null))} /> : null}

    <View style={styles.exerciseHeader}>
      <Text style={styles.eyebrow}>CURRENT EXERCISE</Text>
      <View style={styles.exerciseNameRow}>
        <Text style={styles.exercise}>{exercise.name}</Text>
        {exercise.user_added ? <Text style={styles.addedChip}>+ ADDED</Text> : null}
      </View>
      <Text style={styles.setLabel}>Set {current.setIndex + 1} of {exercise.sets.length}</Text>
    </View>

    {exerciseOptions ? (
      <View style={styles.alternativesRow}>
        {exerciseOptions.map((option) => {
          const isMain = option.client_id === plannedExercise?.client_id;
          const selected = isMain ? !exercise.selected_alternative_id : exercise.selected_alternative_id === option.client_id;
          return (
            <Pressable
              key={option.client_id}
              accessibilityRole="button"
              accessibilityLabel={`Do ${option.name}`}
              accessibilityState={{ selected }}
              style={[styles.alternativeChip, selected ? styles.alternativeChipActive : null]}
              onPress={() => dispatch({
                type: 'select_exercise_alternative',
                exerciseIndex: current.exerciseIndex,
                name: option.name,
                catalogueExerciseId: option.catalogue_exercise_id,
                selectedAlternativeId: isMain ? null : option.client_id,
              })}
            >
              <Text style={[styles.alternativeChipText, selected ? styles.alternativeChipTextActive : null]}>{option.name}</Text>
            </Pressable>
          );
        })}
      </View>
    ) : null}

    <PlannedReferenceRow reference={plannedRef} delta={plannedDelta} />

    <View style={styles.card}>
      {exercise.user_added ? <TextInput accessibilityLabel="Actual exercise name" style={styles.nameInput} value={exercise.name} onChangeText={(name) => dispatch({ type: 'set_exercise_name', exerciseIndex: current.exerciseIndex, name })} /> : null}
      <View style={styles.fieldsRow}>
        <NumberField
          label="KG" value={formatWeightValue(set.weight_kg ?? null)} keyboardType="decimal-pad"
          accessibilityLabel={`${exercise.name} set ${current.setIndex + 1} kilograms`}
          decrementLabel="Decrease weight by 2.5 kilograms" incrementLabel="Increase weight by 2.5 kilograms"
          onChangeText={(text) => dispatch({ type: 'set_weight', exerciseIndex: current.exerciseIndex, setIndex: current.setIndex, weightKg: parseWeightInput(text) })}
          onDecrement={() => dispatch({ type: 'set_weight', exerciseIndex: current.exerciseIndex, setIndex: current.setIndex, weightKg: adjustWeight(set.weight_kg ?? null, -2.5) })}
          onIncrement={() => dispatch({ type: 'set_weight', exerciseIndex: current.exerciseIndex, setIndex: current.setIndex, weightKg: adjustWeight(set.weight_kg ?? null, 2.5) })}
        />
        <NumberField
          label="REPS" value={String(set.reps)} keyboardType="number-pad"
          accessibilityLabel={`${exercise.name} set ${current.setIndex + 1} reps`}
          decrementLabel="Decrease reps by 1" incrementLabel="Increase reps by 1"
          onChangeText={(text) => dispatch({ type: 'set_reps', exerciseIndex: current.exerciseIndex, setIndex: current.setIndex, reps: parseRepsInput(text, set.reps) })}
          onDecrement={() => dispatch({ type: 'set_reps', exerciseIndex: current.exerciseIndex, setIndex: current.setIndex, reps: adjustReps(set.reps, -1) })}
          onIncrement={() => dispatch({ type: 'set_reps', exerciseIndex: current.exerciseIndex, setIndex: current.setIndex, reps: adjustReps(set.reps, 1) })}
        />
      </View>
    </View>

    <Button
      label="COMPLETE SET" variant="primary" fullWidth accessibilityLabel="Complete set"
      onPress={() => {
        dispatch({ type: 'complete_set', exerciseIndex: current.exerciseIndex, setIndex: current.setIndex });
        setSession((value) => setRestEnd(value, Date.now() + set.rest_seconds * 1_000));
      }}
    />

    <View style={styles.secondaryRow}>
      <View style={styles.secondaryRowItem}>
        <Button label="Skip set" variant="secondary" fullWidth accessibilityLabel="Skip this set" onPress={() => setSkipExpanded((value) => !value)} />
      </View>
      <View style={styles.secondaryRowItem}>
        <Button
          label="Move to later" variant="secondary" fullWidth disabled={!canDefer}
          accessibilityLabel={canDefer ? `Move ${exercise.name} to later` : `Cannot move ${exercise.name} to later — it is the last remaining exercise`}
          onPress={() => setSession((value) => deferCurrentExercise(editor.actualData, value))}
        />
      </View>
    </View>

    {skipExpanded ? <View style={styles.card}>
      <Text style={styles.fieldLabel}>Skip</Text>
      <TextInput accessibilityLabel="Skip reason" style={styles.input} placeholder="Reason (preserved verbatim)" placeholderTextColor={colors.muted} value={skipReason} onChangeText={setSkipReason} />
      <View style={styles.secondaryRow}>
        <View style={styles.secondaryRowItem}>
          <Button
            label="Skip this set" variant="secondary" fullWidth disabled={!skipReason.trim()}
            onPress={() => { dispatch({ type: 'skip_set', exerciseIndex: current.exerciseIndex, setIndex: current.setIndex, reason: skipReason }); setSkipReason(''); setSkipExpanded(false); }}
          />
        </View>
        <View style={styles.secondaryRowItem}>
          <Button
            label="Skip whole exercise" variant="secondary" fullWidth disabled={!skipReason.trim()}
            onPress={() => {
              dispatch({ type: 'skip_exercise', exerciseIndex: current.exerciseIndex, reason: skipReason });
              setSession((value) => setRestEnd(value, null));
              setSkipReason('');
              setSkipExpanded(false);
            }}
          />
        </View>
      </View>
    </View> : null}

    {notesExpanded ? <View style={styles.card}>
      <Text style={styles.fieldLabel}>Additional notes</Text>
      <TextInput accessibilityLabel="Additional notes" multiline style={[styles.input, styles.notesInput]} placeholder="What changed or felt notable?" placeholderTextColor={colors.muted} value={editor.additionalNotes} onChangeText={(notes) => dispatch({ type: 'set_notes', notes })} />
    </View> : null}

    <View style={styles.tertiaryRow}>
      <Button label="+ set" variant="tertiary" accessibilityLabel="Add an actual set" onPress={() => dispatch({ type: 'add_set', exerciseIndex: current.exerciseIndex })} />
      <Button label="+ exercise" variant="tertiary" accessibilityLabel="Add an actual exercise" onPress={() => setPickerVisible(true)} />
      <Button label="Notes" variant="tertiary" accessibilityLabel={notesExpanded ? 'Hide notes' : 'Add notes'} onPress={() => setNotesExpanded((value) => !value)} />
    </View>

    <Button label="Finish workout" variant="secondary" fullWidth accessibilityLabel="Finish workout" onPress={reviewAndConfirm} />

    {message ? <Text style={styles.message}>{message}</Text> : null}

    <ExercisePicker
      visible={pickerVisible}
      onClose={() => setPickerVisible(false)}
      onAddManually={() => { setPickerVisible(false); dispatch({ type: 'add_exercise' }); }}
      onSelect={(catalogueExercise) => { setPickerVisible(false); dispatch({ type: 'add_catalogue_exercise', name: catalogueExercise.name, catalogueExerciseId: catalogueExercise.id }); }}
    />
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, justifyContent: 'center' },
  statusStack: { gap: spacing.md },
  content: { paddingTop: spacing.sm, paddingBottom: spacing.xl, gap: spacing.md },
  topBar: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  planTitle: { color: colors.muted, flex: 1, fontSize: 13, fontWeight: '700' },
  eyebrow: { color: colors.orange, fontWeight: '700', letterSpacing: 1 },
  exerciseHeader: { gap: 2 },
  exerciseNameRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  exercise: { color: colors.text, fontSize: 28, fontWeight: '700' },
  addedChip: { backgroundColor: colors.surfaceRaised, borderRadius: radius.pill, color: colors.orange, fontSize: 11, fontWeight: '800', paddingHorizontal: spacing.xs, paddingVertical: 2 },
  setLabel: { color: colors.muted, fontSize: 16 },
  alternativesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  alternativeChip: { alignItems: 'center', borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, justifyContent: 'center', minHeight: hit.min, paddingHorizontal: spacing.md },
  alternativeChipActive: { backgroundColor: colors.surfaceRaised, borderColor: colors.orange },
  alternativeChipText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  alternativeChipTextActive: { color: colors.orange },
  card: { backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderRadius: radius.lg, borderWidth: 1, gap: spacing.xs, padding: spacing.md },
  fieldsRow: { flexDirection: 'row', gap: spacing.md },
  fieldLabel: { color: colors.muted, fontWeight: '700' },
  nameInput: { borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, color: colors.text, fontSize: 18, minHeight: 44, paddingHorizontal: spacing.sm },
  input: { borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, color: colors.text, minHeight: hit.min, paddingHorizontal: spacing.sm },
  notesInput: { minHeight: 96, textAlignVertical: 'top' },
  secondaryRow: { flexDirection: 'row', gap: spacing.sm },
  secondaryRowItem: { flex: 1 },
  tertiaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'space-between' },
  message: { color: colors.muted, lineHeight: 20 },
  completeCard: { gap: spacing.md },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', gap: spacing.md },
  summaryMetric: { flex: 1, gap: 2 },
  summaryValue: { ...type.heading, color: colors.text },
  summaryLabel: { color: colors.muted, fontSize: 12 },
});
