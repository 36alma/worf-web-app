import {clearAuthCookies, jsonWithStatus, setAuthCookies} from '@/lib/server/auth';
import {callWorfApi} from '@/lib/server/worf';
import {getServerRefreshToken} from '@/lib/utils/cookies';

const parseScopes = () =>
  (process.env.WORF_SCOPES ?? '')
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean);

export async function POST() {
  const refreshToken = await getServerRefreshToken();
  if (!refreshToken) {
    await clearAuthCookies();
    return jsonWithStatus({message: 'Missing refresh token'}, 401);
  }

  const clientId = process.env.WORF_CLIENT_ID;
  const clientSecret = process.env.WORF_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return jsonWithStatus({message: 'WORF_CLIENT_ID and WORF_CLIENT_SECRET are required'}, 500);
  }

  const {status, data} = await callWorfApi('/v1/auth/token', {
    method: 'POST',
    body: {
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
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

  return jsonWithStatus(data, status);
}
