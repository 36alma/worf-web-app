import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {getOAuthRedirectUri} from '../oauth-redirect-uri';

const ORIGIN = 'http://localhost:3000';

describe('getOAuthRedirectUri', () => {
  const originalEnv = {...process.env};

  beforeEach(() => {
    delete process.env.WORF_OAUTH_REDIRECT_URI;
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  afterEach(() => {
    process.env = {...originalEnv};
  });

  it('returns the configured redirect URI verbatim', () => {
    process.env.WORF_OAUTH_REDIRECT_URI = 'https://app.example/api/auth/oauth/callback';

    expect(getOAuthRedirectUri(ORIGIN)).toBe('https://app.example/api/auth/oauth/callback');
  });

  it('falls back to the app URL when no redirect URI is configured', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example';

    expect(getOAuthRedirectUri(ORIGIN)).toBe('https://app.example/api/auth/oauth/callback');
  });

  it('falls back to the request origin when nothing is configured', () => {
    expect(getOAuthRedirectUri(ORIGIN)).toBe('http://localhost:3000/api/auth/oauth/callback');
  });

  it('ignores a blank configured value', () => {
    process.env.WORF_OAUTH_REDIRECT_URI = '   ';
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example';

    expect(getOAuthRedirectUri(ORIGIN)).toBe('https://app.example/api/auth/oauth/callback');
  });

  it('tolerates a trailing slash on the app URL', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example/';

    expect(getOAuthRedirectUri(ORIGIN)).toBe('https://app.example/api/auth/oauth/callback');
  });

  it('never appends a query string', () => {
    // The authorization server matches redirect_uri byte for byte against the
    // registered value, so anything extra (a locale hint, say) breaks the flow.
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example';

    expect(new URL(getOAuthRedirectUri(ORIGIN)).search).toBe('');
  });
});
