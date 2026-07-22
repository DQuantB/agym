import { useEffect, useState } from 'react';
import { Button } from 'react-native';
import { useRouter } from 'expo-router';

import { useAuth } from '@/auth/AuthProvider';
import { Screen, StatusCard } from '@/components/Screen';
import { getSupabaseClient } from '@/lib/supabase';
import { colors } from '@/theme/tokens';

import { loadCalendarPlans, type CalendarPlan } from '@/features/calendar/calendarApi';
import { mapCalendarScreenState } from '@/features/calendar/calendarState';

export default function CalendarScreen() {
  const auth = useAuth();
  const router = useRouter();
  const [proposal, setProposal] = useState<CalendarPlan | null>(null);
  const [active, setActive] = useState<CalendarPlan | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    setProposal(null);
    setActive(null);
    setMessage(null);

    if (!auth.ready || !auth.configured || !auth.session) {
      setLoading(false);
      return () => { mounted = false; };
    }

    const client = getSupabaseClient();
    if (!client) {
      setMessage('This device has no public AGYM data connection yet.');
      return () => { mounted = false; };
    }

    setLoading(true);
    void loadCalendarPlans(client)
      .then((plans) => { if (mounted) { setProposal(plans.proposal); setActive(plans.active); } })
      .catch((error: unknown) => { if (mounted) setMessage(error instanceof Error ? error.message : 'Could not load calendar plans.'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [auth.configured, auth.ready, auth.session]);

  const state = mapCalendarScreenState({
    configured: auth.configured,
    authenticated: Boolean(auth.session),
    loading: !auth.ready || loading,
    error: message,
    proposal,
    active,
  });

  return <Screen eyebrow="CALENDAR" title="Plans">
    {state.kind === 'unconfigured' ? <StatusCard title="Connections are not configured" detail="Add the public AGYM connection before loading your plans." /> : null}
    {state.kind === 'signed_out' ? <StatusCard title="Sign in required" detail="Sign in to view your owner-scoped plans." /> : null}
    {state.kind === 'loading' ? <StatusCard title="Loading plans" detail="Checking your agent proposals and accepted training." /> : null}
    {state.kind === 'error' ? <StatusCard tone="warning" title="Plans unavailable" detail={state.message} /> : null}
    {state.kind === 'loaded' ? <>
      {state.proposal ? <><StatusCard tone="proposal" title={`✧ Agent proposal · ${state.proposal.source}`} detail={`${state.proposal.plan.title} · ${state.proposal.plan.scheduled_for}. Nothing has been applied yet.`} /><Button title="Review proposal" color={colors.orange} accessibilityLabel={`Review agent proposal ${state.proposal.plan.title}`} onPress={() => router.push({ pathname: '/proposal', params: { id: state.proposal!.id } } as never)} /></> : <StatusCard tone="proposal" title="No proposal loaded" detail="Agent-authored plans will appear here for your deliberate review." />}
      {state.active ? <StatusCard title="◇ Planned" detail={`${state.active.plan.title} · ${state.active.plan.scheduled_for}. This accepted plan is ready on its scheduled day.`} /> : <StatusCard title="No scheduled sessions" detail="Only accepted plans can become scheduled training." />}
    </> : null}
  </Screen>;
}
