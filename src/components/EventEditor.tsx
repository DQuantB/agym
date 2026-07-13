import type { DraftEvent, EventPayload } from '../domain/types';
import { useAgymStore } from '../state/store';
import { UncertaintyBadge } from './UncertaintyBadge';

const payloadKinds = ['workout', 'meal', 'bodyweight', 'sleep', 'pain', 'note'] as const;

type PayloadKind = (typeof payloadKinds)[number];

function payloadText(payload: EventPayload) {
  return JSON.stringify(payload, null, 2);
}

function payloadForKind(kind: PayloadKind, previous: EventPayload): EventPayload {
  const previousText = 'text' in previous ? previous.text : 'description' in previous ? previous.description : '';

  switch (kind) {
    case 'workout':
      return { kind, exercises: [{ name: previousText || 'exercise', sets: [{ reps: null, weightKg: null, rpe: null }] }], durationMin: null, notes: null };
    case 'meal':
      return { kind, description: previousText || 'meal', kcal: null, proteinG: null };
    case 'bodyweight':
      return { kind, weightKg: 0.1 };
    case 'sleep':
      return { kind, durationH: null, quality: null };
    case 'pain':
      return { kind, bodyPart: null, description: previousText || 'pain/discomfort', severity: null, notes: null };
    case 'note':
      return { kind, text: previousText || 'note' };
  }
}

export function EventEditor({ draft }: { draft: DraftEvent }) {
  const update = useAgymStore((state) => state.updateDraft);
  const updatePayload = useAgymStore((state) => state.updateDraftPayload);
  const confirm = useAgymStore((state) => state.confirmDraft);
  const discard = useAgymStore((state) => state.discardDraft);

  return (
    <article className="event-card draft">
      <div className="card-head">
        <strong>{draft.payload.kind}</strong>
        <UncertaintyBadge flags={draft.uncertaintyFlags} />
      </div>
      <div className="grid2">
        <label>
          Type
          <select value={draft.payload.kind} onChange={(event) => updatePayload(draft.id, payloadForKind(event.target.value as PayloadKind, draft.payload))}>
            {payloadKinds.map((kind) => (
              <option key={kind} value={kind}>{kind}</option>
            ))}
          </select>
        </label>
        <label>
          Date
          <input value={draft.date} type="date" onChange={(event) => update(draft.id, { date: event.target.value })} />
        </label>
        <label>
          Time
          <input value={draft.time ?? ''} type="time" onChange={(event) => update(draft.id, { time: event.target.value || null })} />
        </label>
      </div>
      <label>
        Editable payload JSON
        <textarea
          aria-label={`${draft.payload.kind} payload JSON`}
          className="json-editor"
          value={payloadText(draft.payload)}
          onChange={(event) => {
            try {
              updatePayload(draft.id, JSON.parse(event.target.value) as EventPayload);
            } catch {
              // Keep editing until the JSON is valid.
            }
          }}
        />
      </label>
      <p className="source">source: “{draft.sourceText}”</p>
      <div className="row">
        <button className="primary" onClick={() => confirm(draft.id)}>Confirm</button>
        <button className="ghost" onClick={() => discard(draft.id)}>Discard</button>
      </div>
    </article>
  );
}
