import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DraftEventSchema } from '../domain/schemas';
import { discoverParserFixtures, runParserFixture } from './fixtureHarness';
import type { ParseResult } from './Parser';
import { mockParser } from './mockParser';

const mockFixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'mock-v1');

function stubIds(prefix: string) {
  let i = 0;
  Object.defineProperty(globalThis, 'crypto', {
    value: { randomUUID: () => `${prefix}-uuid-${++i}` },
    configurable: true,
  });
}

async function parse(text:string){ return mockParser.parse({ text, defaultDate:'2026-07-11', rawLogId:'raw_test' }); }

describe('mockParser', () => {
  it('passes golden parser fixtures', async () => {
    const fixtures = await discoverParserFixtures(mockFixturesDir);
    expect(fixtures).toHaveLength(10);

    for (const fixture of fixtures) {
      stubIds(fixture.name);
      const actual = await runParserFixture(fixture, {
        parser: mockParser,
        fixturesDir: mockFixturesDir,
      });

      expect(actual, fixture.name).toEqual(fixture.expected);
      expect(actual.events.every((event) => DraftEventSchema.safeParse(event).success)).toBe(true);
    }
  });

  it('parses simple workout and preserves source text', async () => { const r=await parse('Squat 3x8@80kg; bench 3x5 @ 60kg'); expect(r.events.every(e=>DraftEventSchema.safeParse(e).success)).toBe(true); expect(r.events.some(e=>e.payload.kind==='workout')).toBe(true); const json=JSON.stringify(r.events); expect(json).toContain('Squat'); expect(json).toContain('80'); expect(json).toContain('bench'); });
  it('routes pain to pain payload without medical claims', async () => { const r=await parse('right knee hurt during squats today'); expect(r.events[0].payload.kind).toBe('pain'); expect(JSON.stringify(r.events)).not.toMatch(/diagnos|treat|risk|rest|ice/i); });
  it('converts lbs and flags conversion', async () => { const r=await parse('bench 3x8 @ 185 lbs felt easy'); const json=JSON.stringify(r.events); expect(json).toContain('83.9'); expect(json).toMatch(/converted from lbs/); });
  it('resolves yesterday relative to the supplied local default date', async () => { const r=await parse('yesterday deadlift 2x5@120kg'); expect(r.events[0].date).toBe('2026-07-10'); });
  it('never throws and returns note for garbage', async () => { const r=await parse('asdf qwerty 123 zzz'); expect(r.events.length).toBeGreaterThanOrEqual(1); expect(r.events[0].payload.kind).toBe('note'); });

  it('fuzzes arbitrary raw strings without throwing or dropping all text', async () => {
    const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ;\n@/-_?.';

    for (let caseIndex = 0; caseIndex < 500; caseIndex += 1) {
      const length = caseIndex % 73;
      const text = Array.from({ length }, (_, charIndex) => alphabet[(caseIndex * 31 + charIndex * 17) % alphabet.length]).join('');

      await expect(mockParser.parse({ text, defaultDate: '2026-07-11', rawLogId: `raw_fuzz_${caseIndex}` })).resolves.toSatisfy((result: ParseResult) => {
        expect(result.events.length).toBeGreaterThanOrEqual(1);
        expect(result.events.every((event) => DraftEventSchema.safeParse(event).success)).toBe(true);
        expect(result.events.every((event) => event.rawLogId === `raw_fuzz_${caseIndex}`)).toBe(true);

        if (text.trim().length > 0) {
          for (const segment of text.split(/[;\n]+/).map((part) => part.trim()).filter(Boolean)) {
            expect(result.events.some((event) => event.sourceText === segment)).toBe(true);
          }
        }

        return true;
      });
    }
  });
});
