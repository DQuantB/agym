import { useState } from 'react';
import { useAgymStore } from '../state/store';

const sample = `Squat 3x8@80kg; bench 3x5 @ 60kg
knee started aching on set 3
13:00 lunch: chicken rice bowl, about 750 kcal`;

export function LogInput() {
  const submitLog = useAgymStore((state) => state.submitLog);
  const [text, setText] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const disabled = !text.trim();

  return (
    <section className="panel log-panel">
      <div className="eyebrow">RAW &gt; REVIEWED &gt; READY</div>
      <h1>Stop re-explaining your fitness history to AI.</h1>
      <p className="lead">Paste the messy reality. AGym preserves the raw log, proposes structure, and waits for your confirmation before it becomes agent-readable memory.</p>
      <label>
        Training log
        <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder={sample} />
      </label>
      <div className="row">
        <label>Date <input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        <button disabled={disabled} onClick={async () => { await submitLog(text, date); setText(''); }}>Parse log</button>
      </div>
      <p className="microcopy">Local-first v0: no backend, no auth, no paid APIs. Data stays in this browser localStorage.</p>
    </section>
  );
}
