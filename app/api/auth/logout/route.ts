import {NextRequest} from 'next/server';
import {clearAuthCookies, jsonWithStatus} from '@/lib/server/auth';
import {callWorfApi} from '@/lib/server/worf';
import {getServerAccessToken, getServerRefreshToken} from '@/lib/utils/cookies';

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => ({}));
  const access_token = getServerAccessToken();
  const refresh_token = getServerRefreshToken();

  const {status, data} = await callWorfApi('/v1/auth/logout', {
    method: 'POST',
    body: {
      ...payload,
      access_token,
      refresh_token
    }
  });

  clearAuthCookies();
  return jsonWithStatus(data, status);
}

