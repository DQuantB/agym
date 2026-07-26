import { useEffect, useState } from 'react';
import { Alert, Button, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useAuth } from '@/auth/AuthProvider';
import { getSupabaseClient } from '@/lib/supabase';
import { colors, spacing } from '@/theme/tokens';

import { acceptCalendarProposal, loadProposalById, type CalendarPlan } from '@/features/calendar/calendarApi';

export default function ProposalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const auth = useAuth();
  const router = useRouter();
  const [proposal, setProposal] = useState<CalendarPlan | null>(null);
  const [message, setMessage] = useState('Loading proposal…');
  const [requestingChanges, setRequestingChanges] = useState(false);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!id || !client || !auth.session) return;
    void loadProposalById(client, id).then((value) => { setProposal(value); setMessage(value ? '' : 'This proposal is no longer awaiting review.'); }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Could not load proposal.'));
  }, [auth.session, id]);

  async function accept(openEditor = false) {
    const client = getSupabaseClient();
    if (!client || !proposal || accepting) return;
    setAccepting(true);
    try {
      await acceptCalendarProposal(client, proposal.id);
      if (openEditor) {
        router.replace({ pathname: '/workout', params: { mode: 'edit', planId: proposal.id } } as never);
        return;
      }
      Alert.alert('Plan accepted', 'This Gym plan is now planned training. Its agent-authored contents remain unchanged.', [{ text: 'Back to calendar', onPress: () => router.back() }]);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Could not accept proposal.';
      setMessage(detail);
      Alert.alert('Could not accept plan', detail);
    } finally { setAccepting(false); }
  }

  if (!proposal) return <View style={styles.screen}><Text style={styles.message}>{message}</Text></View>;
  const handoff = `AGYM revision request\nProposal: ${proposal.id}\nScheduled date: ${proposal.plan.scheduled_for}\nReason: ${reason.trim() || '(choose a reason)'}${note.trim() ? `\nUser note (verbatim): ${note.trim()}` : ''}\n\nPlease return any revision as a new AGYM proposal. This request does not change the current proposal.`;

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}><Text style={styles.eyebrow}>✧ AGENT PROPOSAL · {proposal.source}</Text><Text style={styles.title}>{proposal.plan.title}</Text><Text style={styles.message}>Scheduled for {proposal.plan.scheduled_for}. Sent {new Date(proposal.createdAt).toLocaleString()}. Nothing has been applied yet.</Text>
    {proposal.plan.exercises.map((exercise) => <View key={exercise.client_id} style={styles.card}><Text style={styles.exercise}>{exercise.name}</Text><Text style={styles.message}>{exercise.sets.map((set) => `${set.weight_kg ?? '—'} kg × ${set.reps}`).join(' · ')}</Text></View>)}
    {proposal.plan.notes ? <View style={styles.card}><Text style={styles.exercise}>Agent note</Text><Text style={styles.message}>{proposal.plan.notes}</Text></View> : null}
    <Button title={accepting ? 'Accepting…' : 'Accept — add to calendar'} color={colors.orange} disabled={accepting} onPress={() => Alert.alert('Accept proposal?', 'Only you can turn this proposal into an active planned workout.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Accept plan', onPress: () => void accept() }])} />
    <Button title="Accept & edit future workout" disabled={accepting} onPress={() => Alert.alert('Accept and edit?', 'AGYM will first preserve and accept the agent proposal, then open an editor for your future-workout revision.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Accept & edit', onPress: () => void accept(true) }])} />
    <Button title={requestingChanges ? 'Hide change request' : 'Ask for changes'} onPress={() => setRequestingChanges((value) => !value)} />
    {requestingChanges ? <View style={styles.card}><Text style={styles.exercise}>Prepare external revision request</Text><Text style={styles.message}>AGYM has no chat and will not send this automatically. Choose a reason, add an optional verbatim note, then copy/send it to your external LLM. Any response must return as a new proposal for review.</Text><TextInput style={styles.input} placeholder="Reason, e.g. schedule conflict" placeholderTextColor={colors.muted} value={reason} onChangeText={setReason} /><TextInput multiline style={[styles.input, styles.notes]} placeholder="Optional note — preserved verbatim in this prepared request" placeholderTextColor={colors.muted} value={note} onChangeText={setNote} /><Text selectable style={styles.handoff}>{handoff}</Text></View> : null}
    <Button title="Dismiss for now" onPress={() => router.back()} /><Text style={styles.message}>{message}</Text>
  </ScrollView>;
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.background }, content: { padding: spacing.lg, paddingTop: 64, gap: spacing.md }, eyebrow: { color: colors.orange, fontWeight: '700' }, title: { color: colors.text, fontSize: 28, fontWeight: '700' }, message: { color: colors.muted, lineHeight: 20 }, card: { gap: spacing.sm, padding: spacing.md, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 14 }, exercise: { color: colors.text, fontSize: 17, fontWeight: '700' }, input: { minHeight: 44, paddingHorizontal: spacing.sm, borderRadius: 8, borderColor: colors.border, borderWidth: 1, color: colors.text }, notes: { minHeight: 96, textAlignVertical: 'top' }, handoff: { color: colors.text, lineHeight: 20, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: spacing.sm } });
