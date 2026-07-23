import { describe, expect, it } from 'vitest';

import { authCallbackPath, createAuthRedirectUrl, getAuthorizationCodeFromUrl } from './authRedirect';

describe('native auth redirect helpers', () => {
  it('creates the app callback path through the platform URL factory', () => {
    expect(createAuthRedirectUrl((path) => `agym://${path}`)).toBe('agym://auth/callback');
    expect(authCallbackPath).toBe('auth/callback');
  });

  it('reads a PKCE authorization code from a native callback URL', () => {
    expect(getAuthorizationCodeFromUrl('agym://auth/callback?code=one-time-code&next=%2F')).toBe('one-time-code');
  });

  it('rejects missing, blank, and fragment-only codes', () => {
    expect(getAuthorizationCodeFromUrl(null)).toBeNull();
    expect(getAuthorizationCodeFromUrl('agym://auth/callback')).toBeNull();
    expect(getAuthorizationCodeFromUrl('agym://auth/callback?code=%20')).toBeNull();
    expect(getAuthorizationCodeFromUrl('agym://auth/callback#access_token=not-pkce')).toBeNull();
  });
});
