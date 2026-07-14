import { useEffect } from 'react';
import { BriefingView } from './components/BriefingView';
import { DataPanel } from './components/DataPanel';
import { EventTimeline } from './components/EventTimeline';
import { LogInput } from './components/LogInput';
import { ParsePreview } from './components/ParsePreview';
import { PlansView } from './components/PlansView';
import { WorkoutView } from './components/WorkoutView';
import { useAgymStore } from './state/store';
import type { Tab } from './domain/types';

const tabs: { id: Tab; label: string }[] = [
  { id: 'workout', label: 'Workout' },
  { id: 'log', label: 'Log' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'plans', label: 'Plans' },
  { id: 'briefing', label: 'Briefing' },
  { id: 'data', label: 'Data' },
];

export default function App() {
  const { activeTab, lastMessage } = useAgymStore((state) => state.ui);
  const setTab = useAgymStore((state) => state.setTab);
  const hydrate = useAgymStore((state) => state.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <main>
      <header className="hero">
        <div className="poster-word">AGYM</div>
        <p className="microcopy">Private alpha. User-controlled data. No medical advice.</p>
        <nav aria-label="AGym sections">
          {tabs.map((tab) => (
            <button key={tab.id} className={activeTab === tab.id ? 'active' : ''} onClick={() => setTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </nav>
      </header>
      {lastMessage && <div className="toast">{lastMessage}</div>}
      {activeTab === 'workout' && <WorkoutView />}
      {activeTab === 'log' && <><LogInput /><ParsePreview /></>}
      {activeTab === 'timeline' && <EventTimeline />}
      {activeTab === 'plans' && <PlansView />}
      {activeTab === 'briefing' && <BriefingView />}
      {activeTab === 'data' && <DataPanel />}
      <footer className="microcopy">Private-alpha data is scoped to your signed-in account. Export is available here; account-wide deletion remains a deliberate, audited workflow. AGym stores and summarizes self-reported logs only; it is not medical advice.</footer>
    </main>
  );
}
