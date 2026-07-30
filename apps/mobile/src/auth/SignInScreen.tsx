import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { colors, spacing } from '@/theme/tokens';

export function SignInScreen() {
  const { authError, requestMagicLink } = useAuth();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit() {
    const normalizedEmail = email.trim();
    if (!normalizedEmail || sending) return;

    setSending(true);
    setMessage(null);
    try {
      await requestMagicLink(normalizedEmail);
      setMessage('Check your email for the private AGYM sign-in link.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'AGYM could not send a sign-in link.');
    } finally {
      setSending(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.page}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>AGYM · PRIVATE ALPHA</Text>
        <Text style={styles.title}>Your training data, in your control.</Text>
        <Text style={styles.copy}>Use the invited email address to receive a secure sign-in link.</Text>
        <TextInput
          accessibilityLabel="Email address"
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={colors.muted}
          style={styles.input}
          textContentType="emailAddress"
          value={email}
        />
        <Button label="Email me a sign-in link" variant="primary" fullWidth busy={sending} disabled={!email.trim()} onPress={() => void submit()} />
        {(authError || message) ? <Text accessibilityLiveRegion="polite" style={styles.status}>{authError ?? message}</Text> : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { alignItems: 'center', backgroundColor: colors.background, flex: 1, justifyContent: 'center', padding: spacing.lg },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 20, borderWidth: 1, gap: spacing.md, maxWidth: 480, padding: spacing.lg, width: '100%' },
  eyebrow: { color: colors.orange, fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: colors.text, fontSize: 30, fontWeight: '800', lineHeight: 36 },
  copy: { color: colors.muted, fontSize: 16, lineHeight: 23 },
  input: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: 12, borderWidth: 1, color: colors.text, fontSize: 16, paddingHorizontal: spacing.md, paddingVertical: 14 },
  status: { color: colors.muted, fontSize: 14, lineHeight: 20 },
});
