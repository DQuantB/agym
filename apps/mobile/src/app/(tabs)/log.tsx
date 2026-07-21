import { Screen, StatusCard } from '@/components/Screen';

export default function LogScreen() {
  return <Screen eyebrow="LOG" title="History"><StatusCard tone="neutral" title="No confirmed sessions" detail="This tab will show what you confirmed actually happened, with its linked planned baseline and evidence." /></Screen>;
}
