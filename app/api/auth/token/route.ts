import {NextRequest, NextResponse} from 'next/server';
import {jsonWithStatus} from '@/lib/server/auth';
import {refreshAccessToken} from '@/lib/server/session-refresh';

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
