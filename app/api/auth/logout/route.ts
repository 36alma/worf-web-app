import {NextRequest} from 'next/server';
import {clearAuthCookies, jsonWithStatus} from '@/lib/server/auth';
import {getAuthClientPayload, MISSING_AUTH_CLIENT_MESSAGE} from '@/lib/server/auth-client';
import {callWorfApi} from '@/lib/server/worf';
import {getServerAccessToken, getServerRefreshToken} from '@/lib/utils/cookies';

export async function POST(request: NextRequest) {
  const authClientPayload = getAuthClientPayload();
  if (!authClientPayload) {
    return jsonWithStatus({message: MISSING_AUTH_CLIENT_MESSAGE}, 500);
  }

  const payload = await request.json().catch(() => ({}));
  const access_token = await getServerAccessToken();
  const refresh_token = await getServerRefreshToken();

  const {status, data} = await callWorfApi('/v1/auth/logout', {
    method: 'POST',
    body: {
      ...payload,
      ...authClientPayload,
      access_token,
      refresh_token
    }
  });

  await clearAuthCookies();
  return jsonWithStatus(data, status);
}