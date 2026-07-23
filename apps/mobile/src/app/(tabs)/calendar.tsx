import { useEffect, useState } from 'react';
import { Button } from 'react-native';
import { useRouter } from 'expo-router';

import { useAuth } from '@/auth/AuthProvider';
import { Screen, StatusCard } from '@/components/Screen';
import { getSupabaseClient } from '@/lib/supabase';
import { colors } from '@/theme/tokens';

import { loadCalendarPlans, type CalendarPlan } from '@/features/calendar/calendarApi';

export default function CalendarScreen() {
  const auth = useAuth();
  const router = useRouter();
  const [proposal, setProposal] = useState<CalendarPlan | null>(null);
  const [active, setActive] = useState<CalendarPlan | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!auth.session || !client) return;
    let mounted = true;
    void loadCalendarPlans(client).then((plans) => { if (mounted) { setProposal(plans.proposal); setActive(plans.active); } }).catch((error: unknown) => { if (mounted) setMessage(error instanceof Error ? error.message : 'Could not load calendar plans.'); });
    return () => { mounted = false; };
  }, [auth.session]);

  return <Screen eyebrow="CALENDAR" title="Plans">
    {message ? <StatusCard tone="warning" title="Calendar unavailable" detail={message} /> : null}
    {!auth.configured ? <StatusCard title="Connections are not configured" detail="Add the public AGYM connection before loading your plans." /> : null}
    {proposal ? <><StatusCard tone="proposal" title={`✧ Agent proposal · ${proposal.source}`} detail={`${proposal.plan.title} · ${proposal.plan.scheduled_for}. Nothing has been applied yet.`} /><Button title="Review proposal" color={colors.orange} accessibilityLabel={`Review agent proposal ${proposal.plan.title}`} onPress={() => router.push({ pathname: '/proposal', params: { id: proposal.id } } as never)} /></> : <StatusCard tone="proposal" title="No proposal loaded" detail="Agent-authored plans will appear here for your deliberate review." />}
    {active ? <StatusCard title="◇ Planned" detail={`${active.plan.title} · ${active.plan.scheduled_for}. This accepted plan is ready on its scheduled day.`} /> : <StatusCard title="No scheduled sessions" detail="Only accepted plans can become scheduled training." />}
  </Screen>;
}
