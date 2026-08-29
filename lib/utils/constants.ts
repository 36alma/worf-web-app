export const ACCESS_COOKIE = 'worf_access_token';
export const REFRESH_COOKIE = 'worf_refresh_token';
export const MFA_COOKIE = 'worf_mfa_token';

export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/'
};

export const WORF_DEVICE_TYPE = process.env.WORF_DEVICE_TYPE ?? 'web';

export const PKCE_VERIFIER_COOKIE = 'worf_pkce_verifier';
export const PKCE_STATE_COOKIE = 'worf_pkce_state';
export const AUTH_ORIGIN_COOKIE = 'worf_auth_origin';
export const OAUTH_AUTH_ORIGIN = 'oauth';

export const PKCE_COOKIE_OPTIONS = {
  ...AUTH_COOKIE_OPTIONS,
  maxAge: 60 * 10
};

export const AUTH_ORIGIN_COOKIE_OPTIONS = {
  ...AUTH_COOKIE_OPTIONS,
  maxAge: 60 * 60 * 24 * 30
};

export const ACCESS_TOKEN_FALLBACK_TTL_SECONDS = 900;

const ACCESS_TOKEN_MAX_TTL_SECONDS = 60 * 60 * 24;

// The access cookie should expire with the token it holds: the server advertises
// expires_in (900s today), and a longer-lived cookie only buys pointless 401
// round trips before the refresh kicks in.
export const resolveAccessTokenMaxAge = (expiresIn?: number): number => {
  if (typeof expiresIn !== 'number' || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    return ACCESS_TOKEN_FALLBACK_TTL_SECONDS;
  }

  return Math.min(Math.floor(expiresIn), ACCESS_TOKEN_MAX_TTL_SECONDS);
};
