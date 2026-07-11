import { describe, expect, it } from 'vitest';
import { DraftEventSchema } from '../domain/schemas';
import { mockParser } from './mockParser';
async function parse(text:string){ return mockParser.parse({ text, defaultDate:'2026-07-11', rawLogId:'raw_test' }); }
describe('mockParser', () => {
  it('parses simple workout and preserves source text', async () => { const r=await parse('Squat 3x8@80kg; bench 3x5 @ 60kg'); expect(r.events.every(e=>DraftEventSchema.safeParse(e).success)).toBe(true); expect(r.events.some(e=>e.payload.kind==='workout')).toBe(true); const json=JSON.stringify(r.events); expect(json).toContain('Squat'); expect(json).toContain('80'); expect(json).toContain('bench'); });
  it('routes pain to pain payload without medical claims', async () => { const r=await parse('right knee hurt during squats today'); expect(r.events[0].payload.kind).toBe('pain'); expect(JSON.stringify(r.events)).not.toMatch(/diagnos|treat|risk|rest|ice/i); });
  it('converts lbs and flags conversion', async () => { const r=await parse('bench 3x8 @ 185 lbs felt easy'); const json=JSON.stringify(r.events); expect(json).toContain('83.9'); expect(json).toMatch(/converted from lbs/); });
  it('never throws and returns note for garbage', async () => { const r=await parse('asdf qwerty 123 zzz'); expect(r.events.length).toBeGreaterThanOrEqual(1); expect(r.events[0].payload.kind).toBe('note'); });
});
