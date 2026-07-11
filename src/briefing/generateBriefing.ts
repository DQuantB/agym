import type { CanonicalEvent, EventPayload } from '../domain/types';
export interface BriefingOptions { from: string; to: string; generatedAt: string; }
type Kind = EventPayload['kind'];
type EventOf<K extends Kind> = CanonicalEvent & { payload: Extract<EventPayload, { kind: K }> };
const kinds = ['workout','meal','bodyweight','sleep','pain','note'] as const;
function inRange(e: CanonicalEvent, o: BriefingOptions) { return e.date >= o.from && e.date <= o.to; }
function byDate(a: CanonicalEvent,b: CanonicalEvent){ return a.date.localeCompare(b.date) || (a.time??'').localeCompare(b.time??'') || a.confirmedAt.localeCompare(b.confirmedAt); }
function label(e: CanonicalEvent){ return `${e.date}${e.time ? ` ${e.time}` : ''}`; }
function q(text: string){ return `  > user wrote: "${text.replace(/"/g, '\"')}"`; }
function group<K extends Kind>(events: CanonicalEvent[], kind: K): EventOf<K>[] { return events.filter((e): e is EventOf<K> => e.payload.kind === kind).sort(byDate); }
function sectionByDate(lines: string[], e: CanonicalEvent, current: {date:string}) { if (current.date !== e.date) { lines.push(`### ${e.date}`); current.date=e.date; } }
export function generateBriefing(events: CanonicalEvent[], opts: BriefingOptions): string {
 const included=events.filter(e=>inRange(e,opts)).sort(byDate); const counts=Object.fromEntries(kinds.map(k=>[k, included.filter(e=>e.payload.kind===k).length]));
 const out:string[]=[]; out.push('# AGym Coach Briefing',`Period: ${opts.from} to ${opts.to}`,'','> User-reported log data only. Not medical advice.','','## Summary',`- Confirmed events: ${included.length}`,`- Workouts: ${counts.workout} · Meals: ${counts.meal} · Bodyweight: ${counts.bodyweight} · Sleep: ${counts.sleep} · Pain: ${counts.pain} · Notes: ${counts.note}`,'');
 out.push('## ⚠ Pain / discomfort'); const pain=group(included,'pain'); if (!pain.length) out.push('No pain/discomfort events logged in this period.'); else for (const e of pain) { const p=e.payload; out.push(`- ${label(e)} — ${p.bodyPart ?? 'unspecified'} — severity: ${p.severity ?? 'not stated'}`, q(p.description)); } out.push('');
 out.push('## Training'); const workouts=group(included,'workout'); if(!workouts.length) out.push('No workout events logged in this period.'); else { const cur={date:''}; for (const e of workouts){ sectionByDate(out,e,cur); const p=e.payload; for (const ex of p.exercises){ if(!ex.sets.length) out.push(`- ${ex.name}: —`); for (const s of ex.sets){ out.push(`- ${ex.name}: ${s.reps ?? '—'} reps @ ${s.weightKg ?? '—'} kg${s.rpe ? ` · RPE ${s.rpe}` : ''}`); } } if(p.notes) out.push(q(p.notes)); } } out.push('');
 out.push('## Nutrition'); const meals=group(included,'meal'); if(!meals.length) out.push('No meal events logged in this period.'); else { const cur={date:''}; let noK=0,noP=0; for(const e of meals){ sectionByDate(out,e,cur); const p=e.payload; if(p.kcal===null) noK++; if(p.proteinG===null) noP++; out.push(`- ${p.description} — kcal: ${p.kcal ?? '—'} · protein: ${p.proteinG ?? '—'} g`);} out.push(`${meals.length-noK} of ${meals.length} meal events have kcal stated; ${noP} of ${meals.length} have no protein stated.`);} out.push('');
 out.push('## Bodyweight'); const bw=group(included,'bodyweight'); if(!bw.length) out.push('No bodyweight events logged in this period.'); else { for(const e of bw) out.push(`- ${label(e)}: ${e.payload.weightKg} kg`); if(bw.length>=2){ const first=bw[0].payload.weightKg; const last=bw[bw.length-1].payload.weightKg; out.push(`First: ${first} kg · last: ${last} kg · delta: ${Math.round((last-first)*10)/10} kg`); } else out.push('Only one value in period — no first/last comparison shown.'); } out.push('');
 out.push('## Sleep'); const sleeps=group(included,'sleep'); if(!sleeps.length) out.push('No sleep events logged in this period.'); else for(const e of sleeps) out.push(`- ${label(e)}: ${e.payload.durationH ?? '—'} h · quality: ${e.payload.quality ?? '—'}`); out.push('');
 out.push('## Notes'); const notes=group(included,'note'); if(!notes.length) out.push('No note events logged in this period.'); else for(const e of notes) out.push(`- ${label(e)}`, q(e.payload.text)); out.push('');
 out.push('## Data quality'); const flags=included.flatMap(e=>e.uncertaintyFlags.map(f=>({e,f}))); if(!flags.length) out.push('0 uncertainty flags in this period.'); else { out.push(`${flags.length} uncertainty flags in this period:`); for(const {e,f} of flags) out.push(`- ${e.date} · ${e.payload.kind} · ${f.field} (${f.reason})`); } out.push('Uncertain fields are flagged for user review.','');
 out.push('## Export metadata', '- schemaVersion: 1', `- generatedAt: ${opts.generatedAt}`, `- events: ${included.length}`, `- range: ${opts.from} to ${opts.to}`);
 return out.join('\n');
}
