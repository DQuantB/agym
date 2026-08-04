import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { Screen, StatusCard } from '@/components/Screen';
import { getSupabaseClient } from '@/lib/supabase';
import { colors, spacing } from '@/theme/tokens';
import { applyWorkoutCorrection, confirmCaptureDraft, saveRawLogAndCreateDraft, type CaptureDraft, type DraftFields } from './captureApi';

const today = () => new Date().toISOString().slice(0, 10);
const numberOrNull = (value: string) => value.trim() ? Number(value) : null;

export function CaptureScreen() {
  const auth = useAuth();
  const router = useRouter();
  const goBack = () => router.back();
  const [text, setText] = useState(''); const [rawEvidence, setRawEvidence] = useState(''); const [date, setDate] = useState(today);
  const [draft, setDraft] = useState<CaptureDraft | null>(null); const [original, setOriginal] = useState<DraftFields | null>(null);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState<string | null>(null);
  const save = async () => { const client = getSupabaseClient(); if (!client || !auth.session) return; setBusy(true); try { const next = await saveRawLogAndCreateDraft(client, auth.session.user.id, { text, date, sourceHint: 'workout' }); setDraft(next); setOriginal(structuredClone(next.fields)); setRawEvidence(text); setText(''); setMessage('Raw evidence saved. Review this uncertain draft.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save capture.'); } finally { setBusy(false); } };
  const confirm = async () => { const client = getSupabaseClient(); if (!client || !auth.session || !draft || !original) return; setBusy(true); try { await confirmCaptureDraft(client, auth.session.user.id, draft, original); setDraft(null); setOriginal(null); setMessage('✓ User confirmed. Raw evidence remains preserved.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not confirm draft.'); } finally { setBusy(false); } };
  if (!getSupabaseClient()) return <Screen eyebrow="CAPTURE" title="Log reality" onBack={goBack}><StatusCard tone="warning" title="Connections are not configured" detail="Configure this device before saving a capture." /></Screen>;
  if (!auth.session) return <Screen eyebrow="CAPTURE" title="Log reality" onBack={goBack}><StatusCard title="Sign in to capture" detail="Your raw logs and confirmations are private to your AGYM account." /></Screen>;
  return <Screen eyebrow="CAPTURE" title="Log reality" onBack={goBack}><ScrollView contentContainerStyle={styles.stack} keyboardShouldPersistTaps="handled">
    {!draft ? <><Text style={styles.lead}>Write the messy reality. AGYM saves your words first, then proposes uncertain structure for review.</Text><TextInput accessibilityLabel="Raw training log" multiline value={text} onChangeText={setText} placeholder="Squat 3x8@80kg; knee felt sore on set 3" placeholderTextColor={colors.muted} style={styles.raw} /><TextInput accessibilityLabel="Log date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} style={styles.input} /><Button title={busy ? 'Saving…' : 'Save raw log and review'} variant="primary" disabled={busy || !text.trim()} onPress={() => void save()} /></> : <>
      <StatusCard tone="proposal" title="◇ Review required" detail="This is an uncertain parse, not a fact. Correct it before confirming." />
      <View style={styles.card}><Text style={styles.label}>Raw evidence preserved</Text><Text style={styles.evidence}>{rawEvidence}</Text></View>
      {draft.fields.kind === 'workout' ? draft.fields.exercises?.map((exercise, exerciseIndex) => <View key={exerciseIndex} style={styles.card}><Text style={styles.label}>Exercise {exerciseIndex + 1}</Text><TextInput accessibilityLabel={`Exercise ${exerciseIndex + 1} name`} value={exercise.name} onChangeText={(name) => setDraft({ ...draft, fields: applyWorkoutCorrection(draft.fields, exerciseIndex, 0, { name }) })} style={styles.input} />{exercise.sets.map((set, setIndex) => <View key={setIndex} style={styles.set}><Text style={styles.label}>Set {setIndex + 1}</Text><TextInput accessibilityLabel={`Exercise ${exerciseIndex + 1} set ${setIndex + 1} reps`} keyboardType="numeric" value={set.reps?.toString() ?? ''} onChangeText={(value) => setDraft({ ...draft, fields: applyWorkoutCorrection(draft.fields, exerciseIndex, setIndex, { reps: numberOrNull(value) }) })} style={styles.input} /><TextInput accessibilityLabel={`Exercise ${exerciseIndex + 1} set ${setIndex + 1} load kg`} keyboardType="decimal-pad" value={set.weightKg?.toString() ?? ''} onChangeText={(value) => setDraft({ ...draft, fields: applyWorkoutCorrection(draft.fields, exerciseIndex, setIndex, { weightKg: numberOrNull(value) }) })} style={styles.input} /></View>)}</View>) : <View style={styles.card}><Text style={styles.label}>Unstructured note</Text><Text style={styles.evidence}>{draft.fields.text ?? 'No safe structure was inferred.'}</Text></View>}
      {draft.safetyFlags.map((flag) => <Text key={`${flag.field}-${flag.reason}`} style={styles.warning}>• {flag.reason}</Text>)}
      <Button title={busy ? 'Confirming…' : 'Confirm corrected result'} variant="primary" disabled={busy} onPress={() => Alert.alert('Confirm result?', 'This creates canonical user-confirmed history. Raw evidence stays unchanged.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Confirm', onPress: () => void confirm() }])} />
      <Button title="Discard draft (keep raw evidence)" disabled={busy} onPress={() => { setDraft(null); setOriginal(null); setMessage('Draft discarded. Raw evidence remains preserved.'); }} />
    </>}{message && <StatusCard tone={message.startsWith('✓') ? 'confirmed' : 'proposal'} title="Capture status" detail={message} />}
  </ScrollView></Screen>;
}
const styles = StyleSheet.create({ stack: { gap: spacing.md }, lead: { color: colors.muted, lineHeight: 21 }, raw: { minHeight: 160, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: spacing.md, color: colors.text, backgroundColor: colors.surface, textAlignVertical: 'top' }, input: { borderColor: colors.border, borderWidth: 1, borderRadius: 10, padding: spacing.sm, color: colors.text, backgroundColor: colors.surface }, card: { gap: spacing.xs, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: spacing.md, backgroundColor: colors.surface }, set: { gap: spacing.xs, borderTopColor: colors.border, borderTopWidth: 1, paddingTop: spacing.sm }, label: { color: colors.orange, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' }, evidence: { color: colors.text, lineHeight: 21 }, warning: { color: colors.muted, lineHeight: 20 } });
