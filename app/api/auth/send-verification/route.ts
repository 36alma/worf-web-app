import {jsonWithStatus} from '@/lib/server/auth';
import {getAuthClientPayload, MISSING_AUTH_CLIENT_MESSAGE} from '@/lib/server/auth-client';
import {callWorfApi} from '@/lib/server/worf';
import {getServerAccessToken} from '@/lib/utils/cookies';

export async function POST() {
  const accessToken = await getServerAccessToken();
  if (!accessToken) {
    return jsonWithStatus({message: 'Missing access token'}, 401);
  }

  const authClientPayload = getAuthClientPayload();
  if (!authClientPayload) {
    return jsonWithStatus({message: MISSING_AUTH_CLIENT_MESSAGE}, 500);
  }

  const {status, data} = await callWorfApi('/v1/auth/send-email-verification', {
    method: 'POST',
    body: authClientPayload,
    token: accessToken
  });

  return jsonWithStatus(data, status);
}