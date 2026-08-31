export type WwwAuthenticateChallenge = {
  scheme?: string;
  error?: string;
  scope?: string;
};

const PARAM_PATTERN = /([a-zA-Z_-]+)\s*=\s*(?:"([^"]*)"|([^,\s]+))/g;

/**
 * Reads the error and scope parameters out of a WWW-Authenticate challenge.
 * The resource server uses these to say which scope a 403 was missing.
 */
export function parseWwwAuthenticate(header: string | null | undefined): WwwAuthenticateChallenge {
  if (!header) {
    return {};
  }

  const challenge: WwwAuthenticateChallenge = {};
  const [scheme] = header.trim().split(/\s+/, 1);
  if (scheme && !scheme.includes('=')) {
    challenge.scheme = scheme;
  }

  for (const match of header.matchAll(PARAM_PATTERN)) {
    const key = match[1].toLowerCase();
    const value = match[2] ?? match[3];
    if (key === 'error') {
      challenge.error = value;
    } else if (key === 'scope') {
      challenge.scope = value;
    }
  }

  return challenge;
}
