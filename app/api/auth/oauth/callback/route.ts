import {NextRequest, NextResponse} from 'next/server';
import {setAuthCookies} from '@/lib/server/auth';

export async function GET(request: NextRequest) {
  const locale = request.nextUrl.searchParams.get('locale') ?? process.env.NEXT_PUBLIC_DEFAULT_LOCALE ?? 'hu';
  const accessToken = request.nextUrl.searchParams.get('access_token');
  const refreshToken = request.nextUrl.searchParams.get('refresh_token');
  const error = request.nextUrl.searchParams.get('error');
  const errorDescription = request.nextUrl.searchParams.get('error_description');

  if (error) {
    const redirectUrl = new URL(`/${locale}/auth/login`, request.nextUrl.origin);
    redirectUrl.searchParams.set('error', errorDescription ?? error);
    return NextResponse.redirect(redirectUrl);
  }

  if (!accessToken || !refreshToken) {
    const redirectUrl = new URL(`/${locale}/auth/login`, request.nextUrl.origin);
    redirectUrl.searchParams.set('error', 'Missing access_token or refresh_token');
    return NextResponse.redirect(redirectUrl);
  }

  setAuthCookies({
    access_token: accessToken,
    refresh_token: refreshToken
  });

  const redirectUrl = new URL(`/${locale}/dashboard`, request.nextUrl.origin);
  return NextResponse.redirect(redirectUrl);
}
