import {NextRequest} from 'next/server';
import {jsonWithStatus} from '@/lib/server/auth';
import {getAuthClientPayload, MISSING_AUTH_CLIENT_MESSAGE} from '@/lib/server/auth-client';
import {callWorfApi} from '@/lib/server/worf';

export async function POST(request: NextRequest) {
  const authClientPayload = getAuthClientPayload();
  if (!authClientPayload) {
    return jsonWithStatus({message: MISSING_AUTH_CLIENT_MESSAGE}, 500);
  }

  const payload = await request.json();
  const {status, data} = await callWorfApi('/v1/auth/forget-password', {
    method: 'POST',
    body: {
      ...payload,
      ...authClientPayload
    }
  });

  return jsonWithStatus(data, status);
}