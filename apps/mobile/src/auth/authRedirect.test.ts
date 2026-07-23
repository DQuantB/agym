import { describe, expect, it } from 'vitest';

import { authCallbackPath, createAuthRedirectUrl, getAuthorizationCodeFromUrl, getAuthSessionTokensFromUrl } from './authRedirect';

describe('native auth redirect helpers', () => {
  it('creates the app callback path through the platform URL factory', () => {
    expect(createAuthRedirectUrl((path) => `agym://${path}`)).toBe('agym://auth/callback');
    expect(authCallbackPath).toBe('auth/callback');
  });

  it('reads a PKCE authorization code from a native callback URL', () => {
    expect(getAuthorizationCodeFromUrl('agym://auth/callback?code=one-time-code&next=%2F')).toBe('one-time-code');
  });

  it('reads complete implicit session tokens from a native callback fragment', () => {
    expect(getAuthSessionTokensFromUrl('agym://auth/callback#access_token=access-token&refresh_token=refresh-token&type=magiclink')).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' });
  });

  it('rejects missing, blank, and incomplete callback credentials', () => {
    expect(getAuthorizationCodeFromUrl(null)).toBeNull();
    expect(getAuthorizationCodeFromUrl('agym://auth/callback')).toBeNull();
    expect(getAuthorizationCodeFromUrl('agym://auth/callback?code=%20')).toBeNull();
    expect(getAuthSessionTokensFromUrl(null)).toBeNull();
    expect(getAuthSessionTokensFromUrl('agym://auth/callback')).toBeNull();
    expect(getAuthSessionTokensFromUrl('agym://auth/callback#access_token=access-only')).toBeNull();
    expect(getAuthSessionTokensFromUrl('agym://auth/callback#access_token=%20&refresh_token=refresh-token')).toBeNull();
  });
});
