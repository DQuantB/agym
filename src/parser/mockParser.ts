import { newId } from '../domain/ids';
import type { DraftEvent, EventPayload, UncertaintyFlag } from '../domain/types';
import type { ParseInput, ParseResult, Parser } from './Parser';

const parserName = 'mock-v1';
const lbToKg = (lb: number) => Math.round(lb * 0.453592 * 10) / 10;
const addDays = (date: string, days: number) => { const d = new Date(`${date}T00:00:00`); d.setDate(d.getDate() + days); return d.toISOString().slice(0,10); };
function dateFor(segment: string, defaultDate: string) { return /\byesterday\b/i.test(segment) ? addDays(defaultDate, -1) : defaultDate; }
function timeFor(segment: string) { return segment.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/)?.[0].padStart(5,'0') ?? null; }
function bodyPart(segment: string) { return segment.match(/\b(knee|shoulder|back|lower back|hamstring|ankle|elbow|wrist|hip|neck|quad|calf)\b/i)?.[0] ?? null; }
function event(input: ParseInput, segment: string, payload: EventPayload, flags: UncertaintyFlag[] = []): DraftEvent { return { id: newId('draft'), rawLogId: input.rawLogId, date: dateFor(segment, input.defaultDate), time: timeFor(segment), payload, uncertaintyFlags: flags, sourceText: segment.trim(), parserVersion: parserName, schemaVersion: 1 }; }
function splitSegments(text: string) { return text.split(/[;\n]+/).map(s => s.trim()).filter(Boolean); }
function parseWorkout(input: ParseInput, segment: string): DraftEvent | null {
  const lower = segment.toLowerCase();
  const pattern = /([a-z][a-z\s-]*?)\s+(\d+)\s*x\s*(\d+)\s*(?:@|at)?\s*(\d+(?:\.\d+)?)?\s*(kg|kgs|lb|lbs)?/gi;
  const exercises: { name: string; sets: { reps: number | null; weightKg: number | null; rpe: number | null }[] }[] = [];
  const flags: UncertaintyFlag[] = [];
  const rpe = lower.match(/rpe\s*(\d+(?:\.\d+)?)/i)?.[1];
  for (const m of segment.matchAll(pattern)) {
    let name = m[1].replace(/\b(yesterday|today|then|and|evening|morning)\b:?/gi, '').trim();
    if (!name) name = 'exercise';
    const sets = Number(m[2]); const reps = Number(m[3]); const rawWeight = m[4] ? Number(m[4]) : null; const unit = (m[5] ?? '').toLowerCase();
    let weightKg: number | null = rawWeight;
    if (rawWeight !== null && unit.startsWith('lb')) { weightKg = lbToKg(rawWeight); flags.push({ field: `payload.exercises.${exercises.length}.sets.weightKg`, reason: 'weight converted from lbs to kg' }); }
    if (rawWeight === null) flags.push({ field: `payload.exercises.${exercises.length}.sets.weightKg`, reason: 'weight not stated' });
    exercises.push({ name, sets: Array.from({length: Math.max(1, sets)}, () => ({ reps, weightKg, rpe: rpe ? Number(rpe) : null })) });
    if (rpe && /by the end/i.test(segment)) flags.push({ field: `payload.exercises.${exercises.length - 1}.sets.rpe`, reason: 'RPE placement in the workout is ambiguous' });
  }
  if (!exercises.length && /\b(squat|bench|deadlift|ohp|pullups?|pushups?|curls?|leg day|run|workout|training)\b/i.test(segment)) {
    if (/leg day/i.test(segment)) return event(input, segment, { kind: 'note', text: segment }, [{ field: 'payload.kind', reason: 'fitness fragment with no structured workout data' }]);
    exercises.push({ name: segment.replace(/[:]/g,'').trim(), sets: [{ reps: null, weightKg: null, rpe: null }] });
    flags.push({ field: 'payload.exercises', reason: 'workout mentioned but sets/reps/load missing or partial' });
  }
  return exercises.length ? event(input, segment, { kind: 'workout', exercises, durationMin: null, notes: null }, flags) : null;
}
function parseMeal(input: ParseInput, segment: string): DraftEvent | null {
  if (!/\b(kcal|cal|protein|ate|breakfast|brekkie|lunch|dinner|meal|pasta|oats|banana|shake|snack|bowl|toast|eggs)\b/i.test(segment)) return null;
  const kcal = segment.match(/(\d+(?:\.\d+)?)\s*(?:kcal|cal)\b/i)?.[1]; const protein = segment.match(/(\d+(?:\.\d+)?)\s*g\s*protein\b/i)?.[1];
  const flags: UncertaintyFlag[] = [];
  if (kcal && /\b(about|maybe|idk|\?\?)\b/i.test(segment)) flags.push({ field: 'payload.kcal', reason: 'user stated approximate calories' });
  return event(input, segment, { kind: 'meal', description: segment.replace(/^\d{1,2}:\d{2}\s*/,'').replace(/^(lunch|breakfast|dinner|brekkie):?\s*/i,'').trim(), kcal: kcal ? Number(kcal) : null, proteinG: protein ? Number(protein) : null }, flags);
}
function parseBodyweight(input: ParseInput, segment: string): DraftEvent | null {
  const m = segment.match(/(?:weighed in at\s*)?(\d{2,3}(?:\.\d+)?)\s*(kg|kgs|lb|lbs)\b/i); if (!m) return null;
  if (/\b(bench|squat|deadlift|ohp|curl|press|@|x)\b/i.test(segment)) return null;
  const unit = m[2].toLowerCase(); const value = Number(m[1]); const flags: UncertaintyFlag[] = [];
  let weightKg = value; if (unit.startsWith('lb')) { weightKg = lbToKg(value); flags.push({ field: 'payload.weightKg', reason: 'bodyweight converted from lbs to kg' }); }
  return event(input, segment, { kind: 'bodyweight', weightKg }, flags);
}
function parseSleep(input: ParseInput, segment: string): DraftEvent | null {
  if (!/\b(slept|sleep)\b/i.test(segment)) return null; const dur = segment.match(/(\d+(?:\.\d+)?)\s*h\b/i)?.[1];
  let quality: 'poor'|'ok'|'good'|null = null; if (/\b(great|rested|good)\b/i.test(segment)) quality='good'; if (/\b(crap|bad|poor|awful)\b/i.test(segment)) quality='poor';
  return event(input, segment, { kind: 'sleep', durationH: dur ? Number(dur) : null, quality });
}
function parsePain(input: ParseInput, segment: string): DraftEvent | null {
  if (!/\b(pain|hurt|aching|ached|sore|tweaked|pulling|injury|discomfort)\b/i.test(segment)) return null;
  const severity = segment.match(/(?:about\s*)?(\d{1,2})\s*\/\s*10/i)?.[1]; const flags: UncertaintyFlag[] = [];
  if (severity && /about/i.test(segment)) flags.push({ field: 'payload.severity', reason: 'severity was stated approximately' });
  return event(input, segment, { kind: 'pain', bodyPart: bodyPart(segment), description: segment, severity: severity ? Number(severity) : null, notes: null }, flags);
}
function parseSegment(input: ParseInput, segment: string) { return parsePain(input, segment) ?? parseBodyweight(input, segment) ?? parseSleep(input, segment) ?? parseMeal(input, segment) ?? parseWorkout(input, segment) ?? event(input, segment, { kind: 'note', text: segment }, [{ field: 'payload.kind', reason: 'unparseable or out-of-domain text preserved as note' }]); }
export const mockParser: Parser = { async parse(input: ParseInput): Promise<ParseResult> { const segments = splitSegments(input.text); const events = segments.length ? segments.map(s => parseSegment(input, s)) : [event(input, input.text || 'empty log', { kind: 'note', text: input.text || 'empty log' }, [{ field: 'sourceText', reason: 'empty or whitespace input' }])]; return { events, parserName, warnings: [] }; } };
