import { describe, expect, it } from 'vitest';
import type { CanonicalEvent } from '../domain/types';
import { generateBriefing } from './generateBriefing';
const base = { id:'e1', rawLogId:'r1', date:'2026-07-11', time:null, sourceText:'source', parserVersion:'mock-v1', schemaVersion:1 as const, confirmedAt:'2026-07-11T12:00:00.000Z', editedByUser:false, provenance:'user_confirmed' as const, uncertaintyFlags:[] };
describe('generateBriefing', () => {
 it('renders required sections, disclaimer, and pain near top', () => { const events:CanonicalEvent[]=[{...base, payload:{kind:'pain', bodyPart:'knee', description:'knee started aching', severity:null, notes:null}, originalPayload:{kind:'pain', bodyPart:'knee', description:'knee started aching', severity:null, notes:null}}]; const md=generateBriefing(events,{from:'2026-07-01',to:'2026-07-14',generatedAt:'2026-07-14T18:00:00Z'}); expect(md).toContain('> User-reported log data only. Not medical advice.'); expect(md.indexOf('## ⚠ Pain / discomfort')).toBeLessThan(md.indexOf('## Training')); expect(md).toContain('> user wrote: "knee started aching"'); expect(md).not.toMatch(/consider|recommend|diagnos|treatment/i); });
 it('states empty data plainly', () => { const md=generateBriefing([],{from:'2026-07-01',to:'2026-07-14',generatedAt:'2026-07-14T18:00:00Z'}); expect(md).toContain('Confirmed events: 0'); expect(md).toContain('No workout events logged in this period.'); });
});
