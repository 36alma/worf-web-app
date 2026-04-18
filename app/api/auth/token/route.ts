import {NextRequest, NextResponse} from 'next/server';
import {clearAuthCookies, jsonWithStatus, setAuthCookies} from '@/lib/server/auth';
import {getAuthClientPayload, MISSING_AUTH_CLIENT_MESSAGE} from '@/lib/server/auth-client';
import {callWorfApi} from '@/lib/server/worf';
import {getServerRefreshToken} from '@/lib/utils/cookies';

const parseScopes = () =>
  (process.env.WORF_SCOPES ?? '')
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean);

type RefreshResult = {
  status: number;
  data: unknown;
};

async function refreshAccessToken(): Promise<RefreshResult> {
  const refreshToken = await getServerRefreshToken();
  if (!refreshToken) {
    await clearAuthCookies();
    return {status: 401, data: {message: 'Missing refresh token'}};
  }

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

const sanitizeRedirectPath = (path: string | null, fallback: string) => {
  if (!path || !path.startsWith('/')) {
    return fallback;
  }

  if (path.startsWith('//')) {
    return fallback;
  }

  return path;
};

export async function POST() {
  const {status, data} = await refreshAccessToken();
  return jsonWithStatus(data, status);
}

export async function GET(request: NextRequest) {
  const requestedFallback = request.nextUrl.searchParams.get('fallback');
  const fallbackPath = sanitizeRedirectPath(requestedFallback, '/hu/auth/login');
  const requestedRedirect = request.nextUrl.searchParams.get('redirect');
  const redirectPath = sanitizeRedirectPath(requestedRedirect, fallbackPath);

  const {status, data} = await refreshAccessToken();
  const tokens = data as {access_token?: string};
  const target = status >= 200 && status < 300 && tokens.access_token ? redirectPath : fallbackPath;

  return NextResponse.redirect(new URL(target, request.nextUrl.origin));
}
