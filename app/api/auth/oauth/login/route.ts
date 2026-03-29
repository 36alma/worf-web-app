import {NextRequest, NextResponse} from 'next/server';

export async function GET(request: NextRequest) {
  const apiBase = process.env.WORF_API_URL;
  const clientId = process.env.WORF_CLIENT_ID;
  const clientSecret = process.env.WORF_CLIENT_SECRET;
  const locale = request.nextUrl.searchParams.get('locale') ?? process.env.NEXT_PUBLIC_DEFAULT_LOCALE ?? 'hu';

  if (!apiBase) {
    return NextResponse.json({message: 'WORF_API_URL is not configured'}, {status: 500});
  }

  const appBase = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
  const callbackUrl = new URL('/api/auth/oauth/callback', appBase.endsWith('/') ? appBase : `${appBase}/`);
  callbackUrl.searchParams.set('locale', locale);

  const loginUrl = new URL('/v1/oauth/login', apiBase.endsWith('/') ? apiBase : `${apiBase}/`);
  const fragmentParams = new URLSearchParams();
  if (clientId) {
    fragmentParams.set('client_id', clientId);
  }
  if (clientSecret) {
    fragmentParams.set('client_secret', clientSecret);
  }
  fragmentParams.set('redirect_uri', callbackUrl.toString());
  loginUrl.hash = fragmentParams.toString();

  return NextResponse.redirect(loginUrl);
}
