import {NextRequest, NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {buildAuthorizeScope, getAuthServerMetadata} from '@/lib/server/oauth-discovery';
import {generatePkcePair, generateState} from '@/lib/server/pkce';
import {PKCE_COOKIE_OPTIONS, PKCE_STATE_COOKIE, PKCE_VERIFIER_COOKIE} from '@/lib/utils/constants';

export async function GET(request: NextRequest) {
  const clientId = process.env.WORF_OAUTH_CLIENT_ID;
  const locale = request.nextUrl.searchParams.get('locale') ?? process.env.NEXT_PUBLIC_DEFAULT_LOCALE ?? 'hu';

  const failWith = (reason: string) => {
    const redirectUrl = new URL(`/${locale}/auth/login`, request.nextUrl.origin);
    redirectUrl.searchParams.set('error', reason);
    return NextResponse.redirect(redirectUrl);
  };

  if (!clientId) {
    return NextResponse.json({message: 'WORF_OAUTH_CLIENT_ID is not configured'}, {status: 500});
  }

  let metadata;
  try {
    metadata = await getAuthServerMetadata();
  } catch (error) {
    console.error('[oauth/login] discovery failed:', error);
    return failWith('temporarily_unavailable');
  }

  const appBase = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
  const callbackUrl = new URL('/api/auth/oauth/callback', appBase.endsWith('/') ? appBase : `${appBase}/`);
  callbackUrl.searchParams.set('locale', locale);

  const {codeVerifier, codeChallenge} = generatePkcePair();
  const state = generateState();

  const jar = await cookies();
  jar.set(PKCE_VERIFIER_COOKIE, codeVerifier, PKCE_COOKIE_OPTIONS);
  jar.set(PKCE_STATE_COOKIE, state, PKCE_COOKIE_OPTIONS);

  const authorizeUrl = new URL(metadata.authorization_endpoint);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('redirect_uri', callbackUrl.toString());
  authorizeUrl.searchParams.set('code_challenge', codeChallenge);
  authorizeUrl.searchParams.set('code_challenge_method', 'S256');
  authorizeUrl.searchParams.set('scope', buildAuthorizeScope(metadata));
  authorizeUrl.searchParams.set('state', state);
  // Deliberately no client_secret (it would leak to the browser) and no
  // resource parameter (the token request omits it too, so they cannot diverge).

  return NextResponse.redirect(authorizeUrl);
}
