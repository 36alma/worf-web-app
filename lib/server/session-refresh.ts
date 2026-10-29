import {cookies} from 'next/headers';
import {clearAuthCookies, setAuthCookies} from '@/lib/server/auth';
import {getAuthClientPayload, MISSING_AUTH_CLIENT_MESSAGE} from '@/lib/server/auth-client';
import {isInvalidGrant, refreshWithOAuthToken} from '@/lib/server/oauth-token';
import {callWorfApi} from '@/lib/server/worf';
import {AUTH_ORIGIN_COOKIE, AUTH_ORIGIN_COOKIE_OPTIONS, OAUTH_AUTH_ORIGIN} from '@/lib/utils/constants';
import {getServerAuthOrigin, getServerRefreshToken} from '@/lib/utils/cookies';

const parseScopes = () =>
  (process.env.WORF_SCOPES ?? '')
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean);

export type RefreshResult = {
  status: number;
  data: unknown;
};

async function refreshOAuthSession(refreshToken: string): Promise<RefreshResult> {
  const result = await refreshWithOAuthToken(refreshToken);
  const {status, data} = result;

  if (status >= 200 && status < 300 && data.access_token) {
    // The refresh token rotates on every use: whatever came back replaces the
    // stored one, and the old value is already dead server-side.
    await setAuthCookies({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in
    });

    const jar = await cookies();
    jar.set(AUTH_ORIGIN_COOKIE, OAUTH_AUTH_ORIGIN, AUTH_ORIGIN_COOKIE_OPTIONS);

    return {status, data};
  }

  // invalid_grant means the token was expired, already used, or its whole
  // rotation chain was revoked after a reuse. Retrying is pointless — the user
  // has to go through the authorize flow again.
  if (isInvalidGrant(result) || status === 400 || status === 401 || status === 403) {
    await clearAuthCookies();
  }

  return {status, data};
}

async function refreshLegacySession(refreshToken: string): Promise<RefreshResult> {
  const authClientPayload = getAuthClientPayload('refresh_token');
  if (!authClientPayload) {
    return {status: 500, data: {message: MISSING_AUTH_CLIENT_MESSAGE}};
  }

  const {status, data} = await callWorfApi('/v1/auth/token', {
    method: 'POST',
    body: {
      ...authClientPayload,
      refresh_token: refreshToken,
      scopes: parseScopes()
    }
  });

  if (status >= 200 && status < 300) {
    const tokens = data as {
      access_token?: string;
      refresh_token?: string;
      multi_factor_token?: string;
    };

    await setAuthCookies({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      multi_factor_token: tokens.multi_factor_token
    });
  } else if (status === 401 || status === 403) {
    await clearAuthCookies();
  }

  return {status, data};
}

export async function refreshAccessToken(): Promise<RefreshResult> {
  const refreshToken = await getServerRefreshToken();
  if (!refreshToken) {
    await clearAuthCookies();
    return {status: 401, data: {message: 'Missing refresh token'}};
  }

  const authOrigin = await getServerAuthOrigin();
  return authOrigin === OAUTH_AUTH_ORIGIN
    ? refreshOAuthSession(refreshToken)
    : refreshLegacySession(refreshToken);
}
