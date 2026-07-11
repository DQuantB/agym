import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { Parser, ParseInput, ParseResult } from './Parser';
import { discoverParserFixtures, runParserFixture } from './fixtureHarness';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

const placeholderParser: Parser = {
  async parse(input: ParseInput): Promise<ParseResult> {
    return {
      events: [
        {
          id: 'draft_fixture_1',
          rawLogId: input.rawLogId,
          date: input.defaultDate,
          time: null,
          payload: { kind: 'note', text: input.text },
          uncertaintyFlags: [
            {
              field: 'payload.kind',
              reason: 'placeholder parser preserves text as a note',
            },
          ],
          sourceText: input.text,
          parserVersion: 'placeholder-v1',
          schemaVersion: 1,
        },
      ],
      parserName: 'placeholder-v1',
      warnings: [],
    };
  },
};

describe('parser fixture harness', () => {
  it('discovers txt/expected.json fixture pairs automatically', async () => {
    const fixtures = await discoverParserFixtures(fixturesDir);

    expect(fixtures.map((fixture) => fixture.name)).toEqual([
      '01-workout-note',
      '02-mixed-note',
    ]);
  });

  it('runs every discovered fixture against a parser and compares deep equality', async () => {
    const fixtures = await discoverParserFixtures(fixturesDir);

    for (const fixture of fixtures) {
      const actual = await runParserFixture(fixture, {
        parser: placeholderParser,
        fixturesDir,
      });

      expect(actual, fixture.name).toEqual(fixture.expected);
    }
  });
});
