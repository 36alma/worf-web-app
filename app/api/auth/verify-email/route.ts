import {NextRequest} from 'next/server';
import {jsonWithStatus} from '@/lib/server/auth';
import {getAuthClientPayload, MISSING_AUTH_CLIENT_MESSAGE} from '@/lib/server/auth-client';
import {callWorfApi} from '@/lib/server/worf';

type VerifyEmailPayload = {
  token?: string;
};

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => ({}))) as VerifyEmailPayload;
  const token = payload.token?.trim();

  if (!token) {
    return jsonWithStatus({message: 'Missing verification token'}, 400);
  }

  const authClientPayload = getAuthClientPayload();
  if (!authClientPayload) {
    return jsonWithStatus({message: MISSING_AUTH_CLIENT_MESSAGE}, 500);
  }

  const endpoint = '/v1/auth/verify-email/{email_verification_token}'.replace(
    '{email_verification_token}',
    encodeURIComponent(token)
  );

  const {status, data} = await callWorfApi(endpoint, {
    method: 'POST',
    body: {
      ...authClientPayload,
      email_verification_token: token
    }
  });

  return jsonWithStatus(data, status);
}
