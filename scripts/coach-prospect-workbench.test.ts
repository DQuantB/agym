import { describe, expect, it } from 'vitest';
import { parseAndScore, renderQueries, renderReviewQueue } from './coach-prospect-workbench.mts';

const publicCandidate = {
  publicNameOrHandle: 'Example Strength Coach',
  publicUrl: 'https://example.com/online-coaching',
  platform: 'website',
  onlineCoachFit: 2,
  checkInEvidence: 2,
  workflowRelevance: 1,
  reachability: 2,
  risk: 2,
  publicEvidence: 'Fictional public page says weekly online coaching check-ins.',
  likelyChannel: 'public contact form',
  communityRule: 'ASK',
};

describe('coach prospect workbench', () => {
  it('scores public candidates deterministically and renders only review-eligible rows', () => {
    const candidates = parseAndScore(JSON.stringify([
      { ...publicCandidate, publicNameOrHandle: 'No Rule Candidate', communityRule: 'NO' },
      publicCandidate,
    ]));

    expect(candidates).toHaveLength(2);
    expect(candidates[0]?.score).toBe(9);
    const queue = renderReviewQueue(candidates);
    expect(queue).toContain('Example Strength Coach');
    expect(queue).not.toContain('No Rule Candidate');
    expect(queue).toContain('does not authorize contact');
  });

  it('rejects non-public URLs and invalid scoring values', () => {
    expect(() => parseAndScore(JSON.stringify([{ ...publicCandidate, publicUrl: 'ftp://example.com' }]))).toThrow('http(s) URL');
    expect(() => parseAndScore(JSON.stringify([{ ...publicCandidate, risk: 3 }]))).toThrow('must be 0, 1, or 2');
  });

  it('produces labelled manual public-search queries without fetching anything', () => {
    const queries = renderQueries();
    expect(queries).toContain('Instagram / YouTube');
    expect(queries).toContain('LinkedIn / X');
    expect(queries).toContain('google.com/search?q=');
  });
});
