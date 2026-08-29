import {timingSafeEqual} from 'node:crypto';
import {NextRequest, NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {setAuthCookies} from '@/lib/server/auth';
import {getAuthServerMetadata} from '@/lib/server/oauth-discovery';
import {exchangeAuthorizationCode} from '@/lib/server/oauth-token';
import {
  AUTH_ORIGIN_COOKIE,
  AUTH_ORIGIN_COOKIE_OPTIONS,
  OAUTH_AUTH_ORIGIN,
  PKCE_STATE_COOKIE,
  PKCE_VERIFIER_COOKIE
} from '@/lib/utils/constants';

const safeEquals = (a: string, b: string): boolean => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

export async function GET(request: NextRequest) {
  const locale = request.nextUrl.searchParams.get('locale') ?? process.env.NEXT_PUBLIC_DEFAULT_LOCALE ?? 'hu';
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const issuer = request.nextUrl.searchParams.get('iss');
  const error = request.nextUrl.searchParams.get('error');
  const errorDescription = request.nextUrl.searchParams.get('error_description');

  const jar = await cookies();
  const storedVerifier = jar.get(PKCE_VERIFIER_COOKIE)?.value;
  const storedState = jar.get(PKCE_STATE_COOKIE)?.value;
  jar.delete(PKCE_VERIFIER_COOKIE);
  jar.delete(PKCE_STATE_COOKIE);

  const failWith = (reason: string) => {
    const redirectUrl = new URL(`/${locale}/auth/login`, request.nextUrl.origin);
    redirectUrl.searchParams.set('error', reason);
    return NextResponse.redirect(redirectUrl);
  };

  // RFC 9207: validate the issuer before anything else in the response,
  // the error branch included — a mix-up attack can forge either one.
  let metadata;
  try {
    metadata = await getAuthServerMetadata();
  } catch (discoveryError) {
    console.error('[oauth/callback] discovery failed:', discoveryError);
    return failWith('temporarily_unavailable');
  }

  if (!issuer || issuer !== metadata.issuer) {
    console.warn('[oauth/callback] rejected a response with an unexpected iss parameter');
    return failWith('invalid_issuer');
  }

  if (error) {
    return failWith(errorDescription ?? error);
  }

  if (!code || !state) {
    return failWith('invalid_request');
  }

  if (!storedState || !safeEquals(state, storedState)) {
    return failWith('invalid_state');
  }

  if (!storedVerifier) {
    return failWith('expired_request');
  }

  const appBase = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
  const callbackUrl = new URL('/api/auth/oauth/callback', appBase.endsWith('/') ? appBase : `${appBase}/`);
  callbackUrl.searchParams.set('locale', locale);

  const {status, data} = await exchangeAuthorizationCode({
    code,
    redirectUri: callbackUrl.toString(),
    codeVerifier: storedVerifier
  });

  if (status < 200 || status >= 300 || !data.access_token) {
    return failWith(data.error_description ?? data.error ?? 'token_exchange_failed');
  }

  if (!data.refresh_token) {
    // offline_access was requested, so a missing refresh token means the server
    // narrowed the grant: this session ends when the access token expires.
    console.warn('[oauth/callback] token response contained no refresh_token despite offline_access');
  }

  await setAuthCookies({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in
  });
  jar.set(AUTH_ORIGIN_COOKIE, OAUTH_AUTH_ORIGIN, AUTH_ORIGIN_COOKIE_OPTIONS);

  return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.nextUrl.origin));
}
