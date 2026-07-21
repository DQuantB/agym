import { Screen, StatusCard } from '@/components/Screen';

export default function TodayScreen() {
  return <Screen eyebrow="AGYM · TODAY" title="Today"><StatusCard tone="neutral" title="No active session" detail="Accepted training will appear here. A proposal is not applied until you review and accept it." /><StatusCard tone="proposal" title="Proposal status is separate" detail="Review proposed training from Calendar. Nothing starts from a proposal." /></Screen>;
}
