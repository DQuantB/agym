import { readFileSync } from 'node:fs';
import process from 'node:process';

export type CommunityRule = 'GO' | 'ASK' | 'NO';

type Score = 0 | 1 | 2;

export type Candidate = {
  publicNameOrHandle: string;
  publicUrl: string;
  platform: string;
  onlineCoachFit: Score;
  checkInEvidence: Score;
  workflowRelevance: Score;
  reachability: Score;
  risk: Score;
  publicEvidence: string;
  likelyChannel: string;
  communityRule: CommunityRule;
};

export type ScoredCandidate = Candidate & { score: number };

const REQUIRED_FIELDS: (keyof Candidate)[] = [
  'publicNameOrHandle',
  'publicUrl',
  'platform',
  'onlineCoachFit',
  'checkInEvidence',
  'workflowRelevance',
  'reachability',
  'risk',
  'publicEvidence',
  'likelyChannel',
  'communityRule',
];

const SEARCH_QUERIES = [
  ['Instagram / YouTube', '"online strength coach" "weekly check-in"'],
  ['Instagram / YouTube', '"online hypertrophy coach" clients check-in'],
  ['LinkedIn / X', 'site:linkedin.com/posts "online coach" "weekly check-in"'],
  ['LinkedIn / X', 'site:x.com coach "ChatGPT" programming'],
  ['Podcasts / newsletters', '"strength coach" "client check-ins" podcast'],
  ['Podcasts / newsletters', '"online coaching" "plan adjustments" strength coach'],
] as const;

function isScore(value: unknown): value is Score {
  return value === 0 || value === 1 || value === 2;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export function validateCandidate(value: unknown, index: number): Candidate {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Candidate ${index + 1} must be an object.`);
  }

  const candidate = value as Record<string, unknown>;
  for (const field of REQUIRED_FIELDS) {
    if (!(field in candidate)) {
      throw new Error(`Candidate ${index + 1} is missing required field "${field}".`);
    }
  }

  const textFields: (keyof Candidate)[] = [
    'publicNameOrHandle',
    'publicUrl',
    'platform',
    'publicEvidence',
    'likelyChannel',
  ];
  for (const field of textFields) {
    if (!isNonEmptyString(candidate[field])) {
      throw new Error(`Candidate ${index + 1} field "${field}" must be a non-empty public-only string.`);
    }
  }

  if (!isHttpUrl(candidate.publicUrl as string)) {
    throw new Error(`Candidate ${index + 1} publicUrl must be an http(s) URL.`);
  }

  for (const field of ['onlineCoachFit', 'checkInEvidence', 'workflowRelevance', 'reachability', 'risk'] as const) {
    if (!isScore(candidate[field])) {
      throw new Error(`Candidate ${index + 1} field "${field}" must be 0, 1, or 2.`);
    }
  }

  if (!['GO', 'ASK', 'NO'].includes(candidate.communityRule as string)) {
    throw new Error(`Candidate ${index + 1} communityRule must be GO, ASK, or NO.`);
  }

  return candidate as Candidate;
}

export function scoreCandidate(candidate: Candidate): ScoredCandidate {
  return {
    ...candidate,
    score:
      candidate.onlineCoachFit
      + candidate.checkInEvidence
      + candidate.workflowRelevance
      + candidate.reachability
      + candidate.risk,
  };
}

export function parseAndScore(input: string): ScoredCandidate[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    throw new Error('Input must be valid JSON containing an array of candidate records.');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Input must be a JSON array of candidate records.');
  }

  return parsed
    .map(validateCandidate)
    .map(scoreCandidate)
    .sort((left, right) => right.score - left.score || left.publicNameOrHandle.localeCompare(right.publicNameOrHandle));
}

function escapeCell(value: string): string {
  return value.replaceAll('|', '\\|').replaceAll('\n', ' ').trim();
}

export function renderReviewQueue(candidates: ScoredCandidate[]): string {
  const eligible = candidates.filter((candidate) => candidate.score >= 7 && candidate.communityRule !== 'NO');
  const rows = eligible.map((candidate) => [
    escapeCell(candidate.publicNameOrHandle),
    `[source](${candidate.publicUrl})`,
    escapeCell(candidate.platform),
    escapeCell(candidate.publicEvidence),
    String(candidate.score),
    escapeCell(candidate.likelyChannel),
    candidate.communityRule,
    'pending',
  ]);

  const table = [
    '| Public name / handle | Public source | Platform | Public relevance evidence | Score | Likely first channel | Community rule | Founder decision |',
    '|---|---|---|---|---:|---|---|---|',
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ];

  if (rows.length === 0) {
    table.push('| No candidates meet the score/rule gate yet. |  |  |  |  |  |  |  |');
  }

  return [
    '# Coach prospect founder-review queue',
    '',
    'Status: internal draft. Public-source evidence only. This output does not authorize contact, following, posting, joining a group, or message sending.',
    '',
    ...table,
    '',
    'Before any contact: founder reviews the individual candidate, source evidence, channel rule, and personalized no-link draft.',
  ].join('\n');
}

export function renderQueries(): string {
  const lines = [
    '# Coach discovery public-search queries',
    '',
    'Open these queries manually in a public search engine. The workbench never fetches pages, logs in, scrapes, or sends messages.',
    '',
  ];

  for (const [label, query] of SEARCH_QUERIES) {
    lines.push(`- ${label}: ${query}`);
    lines.push(`  https://www.google.com/search?q=${encodeURIComponent(query)}`);
  }

  return lines.join('\n');
}

function readCandidates(filePath: string): ScoredCandidate[] {
  return parseAndScore(readFileSync(filePath, 'utf8'));
}

export function main(args: string[]): void {
  const [command, filePath] = args;

  if (command === 'queries' && filePath === undefined) {
    console.log(renderQueries());
    return;
  }

  if ((command === 'score' || command === 'render') && filePath !== undefined) {
    const candidates = readCandidates(filePath);
    console.log(command === 'score' ? JSON.stringify(candidates, null, 2) : renderReviewQueue(candidates));
    return;
  }

  throw new Error([
    'Usage:',
    '  npm run prospects:queries',
    '  npm run prospects:score -- <candidate-file.json>',
    '  npm run prospects:render -- <candidate-file.json>',
  ].join('\n'));
}

const invokedPath = process.argv[1] ?? '';
if (invokedPath.endsWith('coach-prospect-workbench.mts')) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Unknown error.');
    process.exitCode = 1;
  }
}
