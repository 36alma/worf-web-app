import {NextRequest} from 'next/server';
import {jsonWithStatus, setAuthCookies} from '@/lib/server/auth';
import {getAuthClientPayload, MISSING_AUTH_CLIENT_MESSAGE} from '@/lib/server/auth-client';
import {callWorfApi} from '@/lib/server/worf';

export async function POST(request: NextRequest) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonWithStatus({message: 'Invalid JSON payload'}, 400);
  }

  const {email, password} = body;
  if (!email || !password) {
    return jsonWithStatus({message: 'Email and password are required'}, 400);
  }

  const authClientPayload = getAuthClientPayload('password');
  if (!authClientPayload) {
    return jsonWithStatus({message: MISSING_AUTH_CLIENT_MESSAGE}, 500);
  }

  const {status, data} = await callWorfApi('/v1/auth/login', {
    method: 'POST',
    body: {
      ...authClientPayload,
      email,
      password
    }
  });

  if (status >= 200 && status < 300) {
    const tokens = data as {
      access_token?: string;
      refresh_token?: string;
    };
    await setAuthCookies(tokens);
  }

  return jsonWithStatus(data, status);
}
