import {buildClientAssertion, CLIENT_ASSERTION_TYPE} from './oauth-client-assertion';
import {getAuthServerMetadata} from './oauth-discovery';

export type OAuthTokenResult = {
  status: number;
  data: {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
    error_description?: string;
    [key: string]: unknown;
  };
};

export const isInvalidGrant = (result: OAuthTokenResult): boolean => result.data.error === 'invalid_grant';

async function postOAuthToken(params: Record<string, string>): Promise<OAuthTokenResult> {
  let tokenEndpoint: string;

  try {
    ({token_endpoint: tokenEndpoint} = await getAuthServerMetadata());
  } catch (error) {
    console.error('[oauth-token] discovery failed:', error);
    return {
      status: 503,
      data: {
        error: 'temporarily_unavailable',
        error_description: 'The authorization server metadata could not be read'
      }
    };
  }

  const assertion = await buildClientAssertion(tokenEndpoint);
  if (!assertion) {
    return {
      status: 500,
      data: {error: 'server_error', error_description: 'OAuth client assertion is not configured'}
    };
  }

  // No resource parameter is ever sent here: the authorization request omits it
  // too, so the server applies its default and invalid_target cannot occur.
  const body = new URLSearchParams({
    ...params,
    client_assertion_type: CLIENT_ASSERTION_TYPE,
    client_assertion: assertion
  });

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: body.toString(),
    cache: 'no-store'
  });

  const data = await response.json().catch(() => ({}));
  return {status: response.status, data};
}

export async function exchangeAuthorizationCode(params: {
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<OAuthTokenResult> {
  return postOAuthToken({
    grant_type: 'authorization_code',
    code: params.code,
    redirect_uri: params.redirectUri,
    code_verifier: params.codeVerifier
  });
}

export async function refreshWithOAuthToken(refreshToken: string): Promise<OAuthTokenResult> {
  // No scope parameter: on a refresh grant it can only narrow what was granted.
  return postOAuthToken({
    grant_type: 'refresh_token',
    refresh_token: refreshToken
  });
}
