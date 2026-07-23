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
