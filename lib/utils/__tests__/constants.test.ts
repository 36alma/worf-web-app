import {describe, expect, it} from 'vitest';
import {
  ACCESS_TOKEN_FALLBACK_TTL_SECONDS,
  AUTH_ORIGIN_COOKIE,
  AUTH_ORIGIN_COOKIE_OPTIONS,
  OAUTH_AUTH_ORIGIN,
  PKCE_COOKIE_OPTIONS,
  PKCE_STATE_COOKIE,
  PKCE_VERIFIER_COOKIE,
  resolveAccessTokenMaxAge
} from '../constants';

describe('OAuth cookie constants', () => {
  it('defines distinct cookie names for PKCE verifier, PKCE state, and auth origin', () => {
    const names = [PKCE_VERIFIER_COOKIE, PKCE_STATE_COOKIE, AUTH_ORIGIN_COOKIE];
    expect(new Set(names).size).toBe(names.length);
    expect(PKCE_VERIFIER_COOKIE).toBe('worf_pkce_verifier');
    expect(PKCE_STATE_COOKIE).toBe('worf_pkce_state');
    expect(AUTH_ORIGIN_COOKIE).toBe('worf_auth_origin');
    expect(OAUTH_AUTH_ORIGIN).toBe('oauth');
  });

  it('sets a short lifetime for PKCE cookies and httpOnly on both option sets', () => {
    expect(PKCE_COOKIE_OPTIONS.maxAge).toBe(600);
    expect(PKCE_COOKIE_OPTIONS.httpOnly).toBe(true);
    expect(AUTH_ORIGIN_COOKIE_OPTIONS.maxAge).toBe(60 * 60 * 24 * 30);
    expect(AUTH_ORIGIN_COOKIE_OPTIONS.httpOnly).toBe(true);
  });
});

describe('resolveAccessTokenMaxAge', () => {
  it('falls back to 900 seconds when expires_in is absent or unusable', () => {
    expect(ACCESS_TOKEN_FALLBACK_TTL_SECONDS).toBe(900);
    expect(resolveAccessTokenMaxAge(undefined)).toBe(900);
    expect(resolveAccessTokenMaxAge(0)).toBe(900);
    expect(resolveAccessTokenMaxAge(-10)).toBe(900);
    expect(resolveAccessTokenMaxAge(Number.NaN)).toBe(900);
  });

  it('uses the advertised lifetime when it is sane', () => {
    expect(resolveAccessTokenMaxAge(900)).toBe(900);
    expect(resolveAccessTokenMaxAge(3600)).toBe(3600);
  });

  it('caps absurd lifetimes at one day', () => {
    expect(resolveAccessTokenMaxAge(60 * 60 * 24 * 30)).toBe(60 * 60 * 24);
  });
});
