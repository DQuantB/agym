import { Screen, StatusCard } from '@/components/Screen';

export default function DataScreen() {
  return <Screen eyebrow="DATA" title="Your data layer"><StatusCard tone="neutral" title="Connections are not configured" detail="AGYM will show only verified data sources and explicitly authorized model access here." /><StatusCard tone="warning" title="Privacy controls arrive with live data" detail="Export, revocation, and deletion controls must reflect real backend capabilities, not placeholders." /></Screen>;
}
