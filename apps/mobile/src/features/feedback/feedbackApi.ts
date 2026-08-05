import type { SupabaseClient } from '@supabase/supabase-js';

export type FeedbackKind = 'bug' | 'idea';
export type FeedbackStatus = 'open' | 'planned' | 'shipped' | 'hidden';

export type FeedbackItem = {
  id: string;
  userId: string;
  kind: FeedbackKind;
  title: string;
  body: string;
  status: FeedbackStatus;
  createdAt: string;
  voteCount: number;
  isMine: boolean;
  hasVoted: boolean;
};

/**
 * Two queries, not one embedded select of feedback_votes(user_id): the votes
 * RLS policy is read-all (needed so a client can toggle its own vote off
 * without a round trip), but that means embedding raw vote rows would hand
 * every reader every other user's voter identity. Counting via the
 * feedback_votes(count) aggregate and asking separately "which of these did
 * I vote for" never puts another user's id in an app response.
 */
export async function loadFeedback(client: SupabaseClient, currentUserId: string): Promise<FeedbackItem[]> {
  const [itemsResult, myVotesResult] = await Promise.all([
    client.from('feedback_items').select('id, user_id, kind, title, body, status, created_at, feedback_votes(count)').order('created_at', { ascending: false }),
    client.from('feedback_votes').select('item_id').eq('user_id', currentUserId),
  ]);
  if (itemsResult.error) throw new Error(`AGYM could not load beta feedback: ${itemsResult.error.message}`);
  if (myVotesResult.error) throw new Error(`AGYM could not load your votes: ${myVotesResult.error.message}`);

  const myVotedIds = new Set((myVotesResult.data ?? []).map((row) => row.item_id as string));
  return (itemsResult.data ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    kind: row.kind as FeedbackKind,
    title: row.title,
    body: row.body,
    status: row.status as FeedbackStatus,
    createdAt: row.created_at,
    voteCount: (row.feedback_votes as { count: number }[] | null)?.[0]?.count ?? 0,
    isMine: row.user_id === currentUserId,
    hasVoted: myVotedIds.has(row.id),
  }));
}

export async function submitFeedback(client: SupabaseClient, userId: string, kind: FeedbackKind, title: string, body: string): Promise<void> {
  const { error } = await client.from('feedback_items').insert({ user_id: userId, kind, title: title.trim(), body: body.trim() });
  if (error) throw new Error(`AGYM could not submit this feedback: ${error.message}`);
}

export async function castVote(client: SupabaseClient, userId: string, itemId: string): Promise<void> {
  const { error } = await client.from('feedback_votes').insert({ item_id: itemId, user_id: userId });
  if (error) throw new Error(`AGYM could not record your vote: ${error.message}`);
}

export async function withdrawVote(client: SupabaseClient, userId: string, itemId: string): Promise<void> {
  const { error } = await client.from('feedback_votes').delete().eq('item_id', itemId).eq('user_id', userId);
  if (error) throw new Error(`AGYM could not withdraw your vote: ${error.message}`);
}
