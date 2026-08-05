import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { Screen, StatusCard } from '@/components/Screen';
import { getSupabaseClient } from '@/lib/supabase';
import { colors, hit, radius, spacing } from '@/theme/tokens';

import { castVote, loadFeedback, submitFeedback, withdrawVote, type FeedbackItem, type FeedbackKind } from './feedbackApi';
import { describeFeedbackAuthor, feedbackKindLabel, sortFeedback, validateFeedbackDraft } from './feedbackBoard';

type LoadState = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready' };

export function FeedbackScreen() {
  const router = useRouter();
  const auth = useAuth();
  const [loadState, setLoadState] = useState<LoadState>({ kind: 'loading' });
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [reloadToken, setReloadToken] = useState(0);
  const [kind, setKind] = useState<FeedbackKind>('idea');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client || !auth.session) {
      setLoadState({ kind: 'error', message: 'This device has no public AGYM data connection yet.' });
      return;
    }
    let active = true;
    setLoadState({ kind: 'loading' });
    void loadFeedback(client, auth.session.user.id).then((loaded) => {
      if (!active) return;
      setItems(loaded);
      setLoadState({ kind: 'ready' });
    }).catch((error: unknown) => {
      if (active) setLoadState({ kind: 'error', message: error instanceof Error ? error.message : 'Could not load beta feedback.' });
    });
    return () => { active = false; };
  }, [auth.session, reloadToken]);

  async function onSubmit() {
    const client = getSupabaseClient();
    if (!client || !auth.session) return;
    const validationError = validateFeedbackDraft(title, body);
    if (validationError) { setMessage(validationError); return; }
    setSubmitting(true);
    setMessage('');
    try {
      await submitFeedback(client, auth.session.user.id, kind, title, body);
      setTitle('');
      setBody('');
      setReloadToken((token) => token + 1);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not submit this feedback.');
    } finally {
      setSubmitting(false);
    }
  }

  async function onToggleVote(item: FeedbackItem) {
    const client = getSupabaseClient();
    if (!client || !auth.session) return;
    setItems((current) => current.map((entry) => entry.id === item.id
      ? { ...entry, hasVoted: !entry.hasVoted, voteCount: entry.voteCount + (entry.hasVoted ? -1 : 1) }
      : entry));
    try {
      if (item.hasVoted) await withdrawVote(client, auth.session.user.id, item.id);
      else await castVote(client, auth.session.user.id, item.id);
    } catch (error) {
      setItems((current) => current.map((entry) => entry.id === item.id ? item : entry));
      setMessage(error instanceof Error ? error.message : 'Could not update your vote.');
    }
  }

  return (
    <Screen eyebrow="BETA" title="Feedback" onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.kindRow}>
            {(['idea', 'bug'] as const).map((option) => (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityLabel={`Report ${feedbackKindLabel(option)}`}
                accessibilityState={{ selected: kind === option }}
                style={[styles.kindChip, kind === option ? styles.kindChipActive : null]}
                onPress={() => setKind(option)}
              >
                <Text style={[styles.kindChipText, kind === option ? styles.kindChipTextActive : null]}>{feedbackKindLabel(option)}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput accessibilityLabel="Feedback title" style={styles.input} placeholder="Short title" placeholderTextColor={colors.muted} value={title} onChangeText={setTitle} maxLength={120} />
          <TextInput accessibilityLabel="Feedback details" multiline style={[styles.input, styles.bodyInput]} placeholder="What happened, or what would help?" placeholderTextColor={colors.muted} value={body} onChangeText={setBody} maxLength={2000} />
          <Text style={styles.notice}>Visible to other beta testers on this shared board. No other identity is attached to what you submit.</Text>
          <Button label="Submit" variant="primary" fullWidth busy={submitting} accessibilityLabel="Submit feedback" onPress={() => void onSubmit()} />
          {message ? <Text style={styles.message}>{message}</Text> : null}
        </View>

        {loadState.kind === 'loading' ? <StatusCard busy title="Loading feedback" detail="Checking the shared beta board." /> : null}
        {loadState.kind === 'error' ? (
          <>
            <StatusCard tone="warning" title="Could not load feedback" detail={loadState.message} />
            <Button label="Retry" variant="secondary" fullWidth onPress={() => setReloadToken((token) => token + 1)} />
          </>
        ) : null}
        {loadState.kind === 'ready' && items.length === 0 ? (
          <StatusCard title="No feedback yet" detail="Be the first to report a bug or request a feature." />
        ) : null}

        {sortFeedback(items).map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemKind}>{feedbackKindLabel(item.kind).toUpperCase()}</Text>
              <Text style={styles.itemAuthor}>{describeFeedbackAuthor(item)}</Text>
            </View>
            <Text style={styles.itemTitle}>{item.title}</Text>
            <Text style={styles.itemBody}>{item.body}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={item.hasVoted ? `Remove your upvote from ${item.title}` : `Upvote ${item.title}`}
              accessibilityState={{ selected: item.hasVoted }}
              style={[styles.voteButton, item.hasVoted ? styles.voteButtonActive : null]}
              onPress={() => void onToggleVote(item)}
            >
              <Text style={[styles.voteButtonText, item.hasVoted ? styles.voteButtonTextActive : null]}>▲ {item.voteCount}</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bodyInput: { minHeight: 96, textAlignVertical: 'top' },
  card: { backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderRadius: radius.lg, borderWidth: 1, gap: spacing.sm, padding: spacing.md },
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  input: { borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, color: colors.text, minHeight: hit.min, paddingHorizontal: spacing.sm },
  itemAuthor: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  itemBody: { color: colors.text, fontSize: 14, lineHeight: 20 },
  itemHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  itemKind: { color: colors.orange, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  itemTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  kindChip: { alignItems: 'center', borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, justifyContent: 'center', minHeight: hit.min, paddingHorizontal: spacing.md },
  kindChipActive: { backgroundColor: colors.surface, borderColor: colors.orange },
  kindChipText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  kindChipTextActive: { color: colors.orange },
  kindRow: { flexDirection: 'row', gap: spacing.xs },
  message: { color: colors.muted, lineHeight: 20 },
  notice: { color: colors.muted, fontSize: 12, lineHeight: 16 },
  voteButton: { alignItems: 'center', alignSelf: 'flex-start', borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, justifyContent: 'center', minHeight: hit.min, paddingHorizontal: spacing.md },
  voteButtonActive: { backgroundColor: colors.surface, borderColor: colors.orange },
  voteButtonText: { color: colors.muted, fontSize: 13, fontWeight: '800' },
  voteButtonTextActive: { color: colors.orange },
});
