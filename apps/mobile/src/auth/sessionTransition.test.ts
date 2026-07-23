import { describe, expect, it } from 'vitest';

import { resolveSessionTransition } from './sessionTransition';

describe('resolveSessionTransition', () => {
  it('is a no-op when the user id is unchanged', () => {
    expect(resolveSessionTransition('user-a', 'user-a')).toBe('none');
    expect(resolveSessionTransition(null, null)).toBe('none');
  });

  it('treats a fresh sign-in (including app reopen restoring a persisted session) as signed_in', () => {
    expect(resolveSessionTransition(null, 'user-a')).toBe('signed_in');
  });

  it('flags a different user id as switched_account, requiring the prior account local state to clear', () => {
    expect(resolveSessionTransition('user-a', 'user-b')).toBe('switched_account');
  });

  it('flags a session going to null as signed_out, requiring local state to clear', () => {
    expect(resolveSessionTransition('user-a', null)).toBe('signed_out');
  });
});
