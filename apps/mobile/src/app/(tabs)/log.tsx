import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { Screen, StatusCard } from '@/components/Screen';
import { getSupabaseClient } from '@/lib/supabase';
import { colors, spacing } from '@/theme/tokens';
import { loadCompletedWorkouts } from '@/features/log/logApi';

export default function LogScreen() {
  const auth = useAuth(); const [items, setItems] = useState<Awaited<ReturnType<typeof loadCompletedWorkouts>>>([]); const [error, setError] = useState<string | null>(null);
  useEffect(() => { const client = getSupabaseClient(); if (!client || !auth.session) return; void loadCompletedWorkouts(client).then(setItems).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not load history.')); }, [auth.session]);
  return <Screen eyebrow="LOG" title="History">{error ? <StatusCard tone="warning" title="History unavailable" detail={error} /> : null}{!items.length && !error ? <StatusCard title="No confirmed sessions" detail="Only sessions you explicitly confirmed appear here." /> : <ScrollView contentContainerStyle={styles.list}>{items.map((item) => <View key={item.id} style={styles.card}><Text style={styles.title}>✓ User confirmed · {new Date(item.confirmedAt).toLocaleDateString()}</Text><Text style={styles.name}>{item.planTitle}</Text><Text style={styles.detail}>Actual: {item.actual.exercises?.map((exercise) => `${exercise.name ?? 'exercise'} (${exercise.sets?.length ?? 0} sets)`).join(' · ') || 'structured workout data'}</Text><Text style={styles.detail}>Linked to the immutable planned baseline and raw execution evidence.{item.notes ? ` Notes: ${item.notes}` : ''}</Text></View>)}</ScrollView>}</Screen>;
}
const styles=StyleSheet.create({list:{gap:spacing.sm},card:{gap:spacing.xs,padding:spacing.md,borderWidth:1,borderColor:colors.border,borderRadius:14,backgroundColor:colors.surface},title:{color:colors.green,fontWeight:'700'},name:{color:colors.text,fontSize:17,fontWeight:'700'},detail:{color:colors.muted,lineHeight:20}});
