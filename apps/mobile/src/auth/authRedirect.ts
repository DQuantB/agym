export const authCallbackPath = 'auth/callback';

export function createAuthRedirectUrl(createUrl: (path: string) => string): string {
  return createUrl(authCallbackPath);
}

export function getAuthorizationCodeFromUrl(url: string | null): string | null {
  if (!url) return null;

  const queryStart = url.indexOf('?');
  if (queryStart === -1) return null;

  const fragmentStart = url.indexOf('#', queryStart);
  const query = url.slice(queryStart + 1, fragmentStart === -1 ? undefined : fragmentStart);
  const code = new URLSearchParams(query).get('code');

  return code?.trim() || null;
}

export function getAuthSessionTokensFromUrl(url: string | null): { accessToken: string; refreshToken: string } | null {
  if (!url) return null;

  const fragmentStart = url.indexOf('#');
  if (fragmentStart === -1) return null;

  const fragment = new URLSearchParams(url.slice(fragmentStart + 1));
  const accessToken = fragment.get('access_token')?.trim();
  const refreshToken = fragment.get('refresh_token')?.trim();

  return accessToken && refreshToken ? { accessToken, refreshToken } : null;
}
