import { useEffect, useState } from 'react';

export function RestTimer({ seconds, onReset }: { seconds: number; onReset(): void }) {
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(seconds > 0);
  useEffect(() => { if (!running || remaining <= 0) return; const timer = window.setInterval(() => setRemaining((v) => v - 1), 1000); return () => window.clearInterval(timer); }, [running, remaining]);
  if (seconds <= 0) return null;
  const minutes = Math.floor(remaining / 60); const remainder = String(remaining % 60).padStart(2, '0');
  return <section className="rest-timer" aria-live="polite"><strong>Rest timer: {minutes}:{remainder}</strong><button className="ghost" onClick={() => setRunning(!running)}>{running ? 'Pause' : 'Resume'}</button><button className="ghost" onClick={() => { onReset(); setRunning(false); }}>Reset</button></section>;
}
