import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { getSupabaseClient } from '@/lib/supabase';
import { colors, spacing } from '@/theme/tokens';

import { formatCatalogueCount } from './catalogueDisplay';
import { CATALOGUE_BODY_PARTS, CATALOGUE_PAGE_SIZE, searchExerciseCatalogue, type CatalogueExercise } from './exerciseCatalogueApi';
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
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<CatalogueExercise | null>(null);
  const pageRef = useRef(0);
  const generationRef = useRef(0);

  useEffect(() => {
    if (!visible) return;
    const generation = ++generationRef.current;
    pageRef.current = 0;
    setLoading(true);
    setLoadingMore(false);
    const client = getSupabaseClient();
    if (!client) { setLoading(false); setMessage('This device has no public AGYM data connection yet.'); return; }

    const timer = setTimeout(() => {
      void searchExerciseCatalogue(client, { text, bodyPart }, { index: 0, size: CATALOGUE_PAGE_SIZE })
        .then(({ items, total: nextTotal }) => {
          if (generationRef.current !== generation) return;
          setResults(items);
          setTotal(nextTotal);
          setMessage(null);
        })
        .catch((error: unknown) => {
          if (generationRef.current !== generation) return;
          setMessage(error instanceof Error ? error.message : 'Could not search the exercise catalogue.');
        })
        .finally(() => { if (generationRef.current === generation) setLoading(false); });
    }, 250);
    return () => clearTimeout(timer);
  }, [visible, text, bodyPart]);

  useEffect(() => {
    if (!visible) {
      setText(''); setBodyPart(null); setResults([]); setTotal(0);
      setLoading(false); setLoadingMore(false); setMessage(null); setSelected(null);
      pageRef.current = 0;
      generationRef.current += 1;
    }
  }, [visible]);

  function loadMore() {
    const client = getSupabaseClient();
    if (!client || loading || loadingMore || results.length >= total) return;
    const generation = generationRef.current;
    const nextIndex = pageRef.current + 1;
    setLoadingMore(true);
    void searchExerciseCatalogue(client, { text, bodyPart }, { index: nextIndex, size: CATALOGUE_PAGE_SIZE })
      .then(({ items, total: nextTotal }) => {
        if (generationRef.current !== generation) return;
        pageRef.current = nextIndex;
        setResults((current) => [...current, ...items]);
        setTotal(nextTotal);
      })
      .catch((error: unknown) => {
        if (generationRef.current !== generation) return;
        setMessage(error instanceof Error ? error.message : 'Could not load more exercises.');
      })
      .finally(() => { if (generationRef.current === generation) setLoadingMore(false); });
  }

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
                accessibilityRole="button"
                accessibilityLabel={`Filter by ${item}`}
                accessibilityState={{ selected: bodyPart === item }}
                hitSlop={6}
                onPress={() => setBodyPart((current) => (current === item ? null : item))}
                style={[styles.chip, bodyPart === item && styles.chipActive]}
              >
                <Text style={[styles.chipText, bodyPart === item && styles.chipTextActive]}>{item}</Text>
              </Pressable>
            )}
          />
          <Text style={styles.message}>{message ?? formatCatalogueCount(results.length, total)}</Text>
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            style={styles.results}
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.orange} style={styles.footerSpinner} /> : null}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.name}, ${item.bodyPart}, ${item.equipment}`}
                style={styles.resultRow}
                onPress={() => setSelected(item)}
              >
                <Text style={styles.resultName}>{item.name}</Text>
                <Text style={styles.resultMeta}>{item.bodyPart} · {item.equipment}</Text>
              </Pressable>
            )}
          />
          <Button label="Can't find it? Add manually" variant="secondary" fullWidth onPress={onAddManually} />
          <Button label="Cancel" variant="tertiary" fullWidth onPress={onClose} />
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
  footerSpinner: { paddingVertical: spacing.md },
});
