import type { FeedbackItem, FeedbackKind } from './feedbackApi';

export function sortFeedback(items: FeedbackItem[]): FeedbackItem[] {
  return [...items].sort((a, b) => b.voteCount - a.voteCount || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// No other identity is ever attached to a shared item -- authorship is
// binary from the reader's point of view, matching the anonymous-board
// privacy decision (the DB only ever tells the client "is this mine").
export function describeFeedbackAuthor(item: Pick<FeedbackItem, 'isMine'>): string {
  return item.isMine ? 'You' : 'A beta tester';
}

export function feedbackKindLabel(kind: FeedbackKind): string {
  return kind === 'bug' ? 'Bug' : 'Idea';
}

export function validateFeedbackDraft(title: string, body: string): string | null {
  if (!title.trim()) return 'Add a short title.';
  if (title.trim().length > 120) return 'Title is too long (120 characters max).';
  if (!body.trim()) return 'Describe the bug or idea.';
  if (body.trim().length > 2000) return 'Description is too long (2000 characters max).';
  return null;
}
