import { Screen, StatusCard } from '@/components/Screen';

export default function CalendarScreen() {
  return <Screen eyebrow="CALENDAR" title="Plans"><StatusCard tone="proposal" title="No proposal loaded" detail="Agent-authored plans are reviewable suggestions. Accepting one is a deliberate action." /><StatusCard title="No scheduled sessions" detail="Only accepted plans can become scheduled training." /></Screen>;
}
