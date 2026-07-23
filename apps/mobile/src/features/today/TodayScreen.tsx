import { Button } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/auth/AuthProvider';
import { Screen, StatusCard } from '@/components/Screen';
import { getSupabaseClient } from '@/lib/supabase';
import { colors } from '@/theme/tokens';

import { loadTodayRemoteData, type TodayRemoteData } from './todayApi';
import { mapTodayState, type TodayState } from './todayState';

function todayLocalDate(date = new Date()): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function stateCard(state: TodayState) {
  switch (state.kind) {
    case 'unconfigured': return <StatusCard title="Connections are not configured" detail="This device has no public AGYM data connection yet." />;
    case 'signed_out': return <StatusCard title="Sign in required" detail="Sign in to view your owner-scoped training context." />;
    case 'loading': return <StatusCard title="Loading today" detail="Checking accepted training and saved workout progress." />;
    case 'error': return <StatusCard tone="warning" title="Could not load today" detail={state.message} />;
    case 'no_session': return <StatusCard title="No active session" detail="No accepted Gym workout is scheduled for today." />;
    case 'proposal_waiting': return <StatusCard tone="proposal" title="✧ Agent proposal" detail={`${state.proposal.title}. Nothing applied yet — review-only training cannot be started.`} />;
    case 'ready': return <StatusCard title="◇ Planned" detail={`${state.plan.title}. This accepted plan is ready; workout execution starts in the next mobile milestone.`} />;
    case 'in_progress': return <StatusCard tone="proposal" title="● Workout in progress" detail={`${state.plan.title}. Your saved actual workout progress will be resumable here.`} />;
    case 'confirmed': return <StatusCard tone="confirmed" title="✓ User confirmed" detail={`${state.plan.title}. This completed outcome is available in your history.`} />;
  }
}

export function TodayScreen() {
  const router = useRouter();
  const auth = useAuth();
  const date = useMemo(() => todayLocalDate(), []);
  const [remote, setRemote] = useState<TodayRemoteData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!auth.ready || !auth.configured || !auth.session) return;
    const client = getSupabaseClient();
    if (!client) return;
    let active = true;
    setLoading(true);
    setError(null);
    void loadTodayRemoteData(client, date)
      .then((data) => { if (active) setRemote(data); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Unknown data error.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [auth.configured, auth.ready, auth.session, date]);

  const state = mapTodayState({
    configured: auth.configured,
    authenticated: Boolean(auth.session),
    loading: !auth.ready || loading,
    error,
    activePlan: remote?.activePlan ?? null,
    execution: remote?.execution ?? null,
    proposal: remote?.proposal ?? null,
  });
  const proposal = 'proposal' in state ? state.proposal : null;

  return (
    <Screen eyebrow={`AGYM · TODAY · ${date}`} title="Today">
      {proposal && state.kind !== 'proposal_waiting' ? <StatusCard tone="proposal" title="✧ Agent proposal" detail={`${proposal.title}. Nothing applied yet — review it in Calendar before it can become planned training.`} /> : null}
      {stateCard(state)}
      {state.kind === 'ready' ? <Button title="Start workout" color={colors.orange} accessibilityLabel="Start accepted planned workout" onPress={() => router.push('/workout' as never)} /> : null}
      {state.kind === 'in_progress' ? <Button title="Resume workout" color={colors.orange} accessibilityLabel="Resume saved workout" onPress={() => router.push('/workout' as never)} /> : null}
    </Screen>
  );
}
