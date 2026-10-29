import {clearAuthCookies, jsonWithStatus} from '@/lib/server/auth';
import {getAuthClientPayload, MISSING_AUTH_CLIENT_MESSAGE} from '@/lib/server/auth-client';
import {refreshAccessToken} from '@/lib/server/session-refresh';
import {callWorfApi} from '@/lib/server/worf';
import {getServerAccessToken, getServerRefreshToken} from '@/lib/utils/cookies';

type TokenPair = {access_token: string; refresh_token: string};

// /v1/auth/logout requires both tokens. The access cookie expires together with its token,
// so after an idle stretch only the refresh token is left: trade it for a fresh pair rather
// than leave a 30-day refresh token alive server-side.
async function resolveTokenPair(): Promise<TokenPair | null> {
  const refresh_token = await getServerRefreshToken();
  if (!refresh_token) {
    return null;
  }

  const access_token = await getServerAccessToken();
  if (access_token) {
    return {access_token, refresh_token};
  }

  const {status, data} = await refreshAccessToken();
  const tokens = data as Partial<TokenPair>;
  if (status < 200 || status >= 300 || !tokens.access_token) {
    return null;
  }

  return {access_token: tokens.access_token, refresh_token: tokens.refresh_token ?? refresh_token};
}

async function revokeUpstreamSession() {
  const authClientPayload = getAuthClientPayload();
  if (!authClientPayload) {
    console.warn(`[logout] ${MISSING_AUTH_CLIENT_MESSAGE}; skipping upstream logout.`);
    return;
  }

  const tokens = await resolveTokenPair();
  if (!tokens) {
    return;
  }

  // The endpoint forbids unknown fields (422), so nothing from the client request is forwarded.
  const {status} = await callWorfApi('/v1/auth/logout', {
    method: 'POST',
    body: {...authClientPayload, ...tokens}
  });

  // 401 means the session was already revoked or expired — nothing left to do.
  if (status !== 200 && status !== 401) {
    console.warn(`[logout] Upstream logout answered ${status}.`);
  }
}

export async function POST() {
  // Best-effort and never retried: the local session ends whatever the backend answers,
  // otherwise the proxy still sees a session and bounces the user back to the dashboard.
  try {
    await revokeUpstreamSession();
  } catch (error) {
    console.warn('[logout] Upstream logout failed.', error);
  }

  await clearAuthCookies();
  return jsonWithStatus({message: 'logged_out'}, 200);
}
