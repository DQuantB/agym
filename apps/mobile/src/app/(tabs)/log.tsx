import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { Screen, StatusCard } from '@/components/Screen';
import { getSupabaseClient } from '@/lib/supabase';
import { colors, spacing } from '@/theme/tokens';
import { loadCompletedWorkouts, loadEvidenceHistory, type EvidenceHistoryItem } from '@/features/log/logApi';

export default function LogScreen() {
  const auth = useAuth(); const [items, setItems] = useState<Awaited<ReturnType<typeof loadCompletedWorkouts>>>([]); const [evidence, setEvidence] = useState<EvidenceHistoryItem[]>([]); const [error, setError] = useState<string | null>(null);
  useFocusEffect(useCallback(() => { const client = getSupabaseClient(); if (!client || !auth.session) return undefined; let active = true; setError(null); void Promise.all([loadCompletedWorkouts(client), loadEvidenceHistory(client)]).then(([workouts, history]) => { if (active) { setItems(workouts); setEvidence(history); } }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load history.'); }); return () => { active = false; }; }, [auth.session]));
  return <Screen eyebrow="HISTORY" title="Your evidence"><ScrollView contentContainerStyle={styles.list}>{error ? <StatusCard tone="warning" title="History unavailable" detail={error} /> : null}{!items.length && !evidence.length && !error ? <StatusCard title="No saved history" detail="Raw reports, uncertain drafts, and only your explicit confirmations appear here." /> : null}{evidence.map((item) => <View key={item.id} style={styles.card}><Text style={styles.label}>{item.label}</Text><Text style={styles.detail}>{new Date(item.date).toLocaleDateString()} · {item.detail}</Text></View>)}{items.map((item) => <View key={item.id} style={styles.card}><Text style={styles.confirmed}>✓ USER-CONFIRMED · {new Date(item.confirmedAt).toLocaleDateString()}</Text><Text style={styles.name}>{item.planTitle}</Text><Text style={styles.detail}>Actual: {item.actual.exercises?.map((exercise) => `${exercise.name ?? 'exercise'} (${exercise.sets?.length ?? 0} sets)`).join(' · ') || 'structured workout data'}</Text></View>)}</ScrollView></Screen>;
}
const styles=StyleSheet.create({list:{gap:spacing.sm},card:{gap:spacing.xs,padding:spacing.md,borderWidth:1,borderColor:colors.border,borderRadius:14,backgroundColor:colors.surface},label:{color:colors.orange,fontWeight:'800',fontSize:12},confirmed:{color:colors.green,fontWeight:'800',fontSize:12},name:{color:colors.text,fontSize:17,fontWeight:'700'},detail:{color:colors.muted,lineHeight:20}});
