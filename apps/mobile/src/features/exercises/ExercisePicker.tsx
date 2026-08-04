import { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { getSupabaseClient } from '@/lib/supabase';
import { colors, spacing } from '@/theme/tokens';

import { CATALOGUE_BODY_PARTS, searchExerciseCatalogue, type CatalogueExercise } from './exerciseCatalogueApi';
import { ExerciseDetail } from './ExerciseDetail';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (exercise: CatalogueExercise) => void;
  onAddManually: () => void;
};

export function ExercisePicker({ visible, onClose, onSelect, onAddManually }: Props) {
  const [text, setText] = useState('');
  const [bodyPart, setBodyPart] = useState<string | null>(null);
  const [results, setResults] = useState<CatalogueExercise[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<CatalogueExercise | null>(null);

  useEffect(() => {
    if (!visible) return;
    const client = getSupabaseClient();
    if (!client) { setMessage('This device has no public AGYM data connection yet.'); return; }

    const timer = setTimeout(() => {
      void searchExerciseCatalogue(client, { text, bodyPart })
        .then((matches) => { setResults(matches); setMessage(matches.length ? null : 'No matching exercises. You can still add one manually.'); })
        .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Could not search the exercise catalogue.'));
    }, 250);
    return () => clearTimeout(timer);
  }, [visible, text, bodyPart]);

  useEffect(() => {
    if (!visible) { setText(''); setBodyPart(null); setResults([]); setMessage(null); setSelected(null); }
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {selected ? (
        <ExerciseDetail
          exercise={selected}
          onBack={() => setSelected(null)}
          onUse={(exercise) => { onSelect(exercise); setSelected(null); }}
        />
      ) : (
        <View style={styles.screen}>
          <Text style={styles.title}>Search exercises</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. bench press"
            placeholderTextColor={colors.muted}
            value={text}
            onChangeText={setText}
            autoFocus
          />
          <FlatList
            horizontal
            data={CATALOGUE_BODY_PARTS}
            keyExtractor={(item) => item}
            style={styles.chipRow}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => setBodyPart((current) => (current === item ? null : item))}
                style={[styles.chip, bodyPart === item && styles.chipActive]}
              >
                <Text style={[styles.chipText, bodyPart === item && styles.chipTextActive]}>{item}</Text>
              </Pressable>
            )}
          />
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            style={styles.results}
            renderItem={({ item }) => (
              <Pressable style={styles.resultRow} onPress={() => setSelected(item)}>
                <Text style={styles.resultName}>{item.name}</Text>
                <Text style={styles.resultMeta}>{item.bodyPart} · {item.equipment}</Text>
              </Pressable>
            )}
          />
          <Button title="Can't find it? Add manually" onPress={onAddManually} />
          <Button title="Cancel" onPress={onClose} />
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, paddingTop: 64, gap: spacing.md },
  title: { color: colors.text, fontSize: 22, fontWeight: '700' },
  input: { minHeight: 44, paddingHorizontal: spacing.sm, borderRadius: 8, borderColor: colors.border, borderWidth: 1, color: colors.text },
  chipRow: { flexGrow: 0 },
  chip: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: 999, borderWidth: 1, borderColor: colors.border, marginRight: spacing.xs },
  chipActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  chipText: { color: colors.muted, fontSize: 13 },
  chipTextActive: { color: colors.background, fontWeight: '700' },
  message: { color: colors.muted, fontSize: 13 },
  results: { flex: 1 },
  resultRow: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  resultName: { color: colors.text, fontSize: 16, fontWeight: '600' },
  resultMeta: { color: colors.muted, fontSize: 12 },
});
