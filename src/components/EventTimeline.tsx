import type { CanonicalEvent } from '../domain/types';
import { useAgymStore } from '../state/store';
import { UncertaintyBadge } from './UncertaintyBadge';

function summarize(event: CanonicalEvent) {
  const payload = event.payload;
  if (payload.kind === 'workout') return payload.exercises.map((exercise) => `${exercise.name}: ${exercise.sets.length} set(s)`).join(', ');
  if (payload.kind === 'meal') return `${payload.description}${payload.kcal ? ` · ${payload.kcal} kcal` : ''}`;
  if (payload.kind === 'bodyweight') return `${payload.weightKg} kg`;
  if (payload.kind === 'sleep') return `${payload.durationH ?? '—'} h · ${payload.quality ?? 'quality —'}`;
  if (payload.kind === 'pain') return `${payload.bodyPart ?? 'unspecified'} · severity ${payload.severity ?? 'not stated'}`;
  return payload.text;
}

function groupByDate(events: CanonicalEvent[]) {
  const groups = new Map<string, CanonicalEvent[]>();
  for (const event of events) {
    groups.set(event.date, [...(groups.get(event.date) ?? []), event]);
  }
  return [...groups.entries()].sort(([left], [right]) => right.localeCompare(left));
}

export function EventTimeline() {
  const events = useAgymStore((state) => state.events).slice().sort((a, b) => b.date.localeCompare(a.date) || (b.time ?? '').localeCompare(a.time ?? ''));
  const deleteEvent = useAgymStore((state) => state.deleteEvent);

  if (!events.length) {
    return <section className="panel"><h2>Canonical memory</h2><p>No confirmed events yet.</p></section>;
  }

  return (
    <section className="panel">
      <h2>Canonical memory</h2>
      {groupByDate(events).map(([date, dayEvents]) => (
        <section key={date} aria-label={`Events for ${date}`}>
          <h3>{date}</h3>
          {dayEvents.map((event) => (
            <article className="event-card" key={event.id}>
              <div className="card-head">
                <strong>{event.time ? `${event.time} · ` : ''}{event.payload.kind}</strong>
                <UncertaintyBadge flags={event.uncertaintyFlags} />
              </div>
              <p>{summarize(event)}</p>
              <p className="source">provenance: {event.provenance} · raw source quoted in export</p>
              <button className="ghost" onClick={() => { if (confirm('Delete this canonical event? Raw log remains preserved.')) void deleteEvent(event.id); }}>
                Delete event
              </button>
            </article>
          ))}
        </section>
      ))}
    </section>
  );
}
