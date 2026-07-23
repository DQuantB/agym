export type SessionTransition = 'none' | 'signed_in' | 'switched_account' | 'signed_out';

/**
 * Account-scoped local stores (drafts/outbox) must be cleared on switched_account
 * and signed_out transitions before the next session's data is used.
 */
export function resolveSessionTransition(previousUserId: string | null, nextUserId: string | null): SessionTransition {
  if (previousUserId === nextUserId) return 'none';
  if (previousUserId && nextUserId) return 'switched_account';
  if (previousUserId && !nextUserId) return 'signed_out';
  return 'signed_in';
}
