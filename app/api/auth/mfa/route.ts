import {NextRequest} from 'next/server';
import {jsonWithStatus, setAuthCookies} from '@/lib/server/auth';
import {getAuthClientPayload, MISSING_AUTH_CLIENT_MESSAGE} from '@/lib/server/auth-client';
import {callWorfApi} from '@/lib/server/worf';
import {getServerMfaToken} from '@/lib/utils/cookies';

type MfaPayload = {
  multi_factor_type: 'totp' | 'email';
  totp_number?: string;
  email_code?: string;
  multi_factor_token?: string;
};

export async function POST(request: NextRequest) {
  const authClientPayload = getAuthClientPayload();
  if (!authClientPayload) {
    return jsonWithStatus({message: MISSING_AUTH_CLIENT_MESSAGE}, 500);
  }

  const payload = (await request.json().catch(() => ({}))) as Partial<MfaPayload>;
  const cookieMfaToken = await getServerMfaToken();
  const multi_factor_token = payload.multi_factor_token ?? cookieMfaToken;

  if (!multi_factor_token) {
    return jsonWithStatus({message: 'Missing multi factor token'}, 401);
  }

  const {status, data} = await callWorfApi('/v1/auth/multi-factor-authentication', {
    method: 'POST',
    body: {
      ...payload,
      ...authClientPayload,
      multi_factor_token
    }
  });

  if (status >= 200 && status < 300) {
    const tokens = data as {
      access_token?: string;
      refresh_token?: string;
      multi_factor_token?: string;
    };

    if (tokens.access_token || tokens.refresh_token || tokens.multi_factor_token) {
      await setAuthCookies(tokens);
    }
  }

  return jsonWithStatus(data, status);
}