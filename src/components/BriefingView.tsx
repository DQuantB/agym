import { useMemo, useState } from 'react';
import { generateBriefing } from '../briefing/generateBriefing';
import { useAgymStore } from '../state/store';

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function download(name: string, content: string, type = 'text/markdown') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function BriefingView() {
  const events = useAgymStore((state) => state.events);
  const [from, setFrom] = useState(daysAgo(13));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [copied, setCopied] = useState(false);
  const markdown = useMemo(() => generateBriefing(events, { from, to, generatedAt: new Date().toISOString() }), [events, from, to]);

  return (
    <section className="panel">
      <div className="split-head">
        <div>
          <div className="eyebrow">CONFIRMED CONTEXT THAT TRAVELS</div>
          <h2>Coach Briefing</h2>
        </div>
        <div className="row">
          <label>From <input aria-label="Briefing from date" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
          <label>To <input aria-label="Briefing to date" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
        </div>
      </div>
      <div className="row">
        <button onClick={async () => { await navigator.clipboard?.writeText(markdown); setCopied(true); }}>Copy markdown</button>
        <button className="ghost" onClick={() => download(`agym-briefing-${new Date().toISOString().slice(0, 10)}.md`, markdown)}>Download .md</button>
      </div>
      {copied && <p role="status">Markdown copied.</p>}
      <pre className="briefing">{markdown}</pre>
    </section>
  );
}
