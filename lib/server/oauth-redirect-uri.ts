/**
 * The authorization server matches redirect_uri against the registered value
 * byte for byte — no wildcards, no prefix match, no extra query parameters —
 * and the authorize request and the token request have to send the exact same
 * string. Both routes resolve it here so the two cannot drift apart.
 *
 * WORF_OAUTH_REDIRECT_URI is the value handed to the registration script, so
 * it wins; the derived fallbacks exist for environments where only the app URL
 * is configured.
 */
export function getOAuthRedirectUri(origin: string): string {
  const configured = process.env.WORF_OAUTH_REDIRECT_URI?.trim();
  if (configured) {
    return configured;
  }

  const base = process.env.NEXT_PUBLIC_APP_URL?.trim() || origin;
  return new URL('/api/auth/oauth/callback', base).toString();
}
