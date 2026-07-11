import { readdir, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { Parser, ParseResult } from './Parser';

export interface ParserFixture {
  name: string;
  textPath: string;
  expectedPath: string;
  text: string;
  expected: ParseResult;
}

export interface RunFixtureOptions {
  parser: Parser;
  fixturesDir: string;
  defaultDate?: string;
  rawLogId?: string;
}

export async function discoverParserFixtures(fixturesDir: string): Promise<ParserFixture[]> {
  const files = await readdir(fixturesDir);
  const textFiles = files.filter((file) => file.endsWith('.txt')).sort();
  const fixtures: ParserFixture[] = [];

  for (const textFile of textFiles) {
    const fixtureName = textFile.slice(0, -'.txt'.length);
    const expectedFile = `${fixtureName}.expected.json`;

    if (!files.includes(expectedFile)) {
      throw new Error(`Missing expected fixture for ${textFile}: expected ${expectedFile}`);
    }

    const textPath = join(fixturesDir, textFile);
    const expectedPath = join(fixturesDir, expectedFile);
    const [text, expectedJson] = await Promise.all([
      readFile(textPath, 'utf8'),
      readFile(expectedPath, 'utf8'),
    ]);

    fixtures.push({
      name: basename(fixtureName),
      textPath,
      expectedPath,
      text,
      expected: JSON.parse(expectedJson) as ParseResult,
    });
  }

  if (fixtures.length === 0) {
    throw new Error(`No parser fixtures found in ${fixturesDir}`);
  }

  return fixtures;
}

export async function runParserFixture(fixture: ParserFixture, options: RunFixtureOptions): Promise<ParseResult> {
  return options.parser.parse({
    text: fixture.text,
    defaultDate: options.defaultDate ?? '2026-07-11',
    rawLogId: options.rawLogId ?? 'raw_fixture',
  });
}
