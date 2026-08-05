import { expect, it } from 'vitest';

import { describeFeedbackAuthor, feedbackKindLabel, sortFeedback, validateFeedbackDraft } from './feedbackBoard';
import type { FeedbackItem } from './feedbackApi';

function item(overrides: Partial<FeedbackItem> = {}): FeedbackItem {
  return {
    id: 'a', userId: 'u1', kind: 'idea', title: 'Title', body: 'Body', status: 'open',
    createdAt: '2026-08-01T00:00:00.000Z', voteCount: 0, isMine: false, hasVoted: false,
    ...overrides,
  };
}

it('sorts by vote count descending, then by recency', () => {
  const items = [
    item({ id: 'low-old', voteCount: 1, createdAt: '2026-08-01T00:00:00.000Z' }),
    item({ id: 'high', voteCount: 5, createdAt: '2026-07-01T00:00:00.000Z' }),
    item({ id: 'low-new', voteCount: 1, createdAt: '2026-08-02T00:00:00.000Z' }),
  ];

  expect(sortFeedback(items).map((entry) => entry.id)).toEqual(['high', 'low-new', 'low-old']);
});

it('does not mutate the input array', () => {
  const items = [item({ id: 'a', voteCount: 1 }), item({ id: 'b', voteCount: 5 })];
  const original = [...items];
  sortFeedback(items);
  expect(items).toEqual(original);
});

it('labels an own item as "You" and exposes no other identity for someone else\'s item', () => {
  expect(describeFeedbackAuthor(item({ isMine: true }))).toBe('You');
  expect(describeFeedbackAuthor(item({ isMine: false }))).toBe('A beta tester');
});

it('labels feedback kind for display', () => {
  expect(feedbackKindLabel('bug')).toBe('Bug');
  expect(feedbackKindLabel('idea')).toBe('Idea');
});

it('requires a non-blank title and body within the DB check-constraint lengths', () => {
  expect(validateFeedbackDraft('', 'Body')).toMatch(/title/i);
  expect(validateFeedbackDraft('  ', 'Body')).toMatch(/title/i);
  expect(validateFeedbackDraft('Title', '')).toMatch(/describe/i);
  expect(validateFeedbackDraft('a'.repeat(121), 'Body')).toMatch(/120/);
  expect(validateFeedbackDraft('Title', 'a'.repeat(2001))).toMatch(/2000/);
  expect(validateFeedbackDraft('Title', 'Body')).toBeNull();
});
