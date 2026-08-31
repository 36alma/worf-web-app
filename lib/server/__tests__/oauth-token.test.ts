import {generateKeyPairSync} from 'node:crypto';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {resetDiscoveryCache} from '../oauth-discovery';
import {exchangeAuthorizationCode, isInvalidGrant, refreshWithOAuthToken} from '../oauth-token';

const METADATA = {
  issuer: 'https://worf.vaultdrive.eu',
  authorization_endpoint: 'https://worf.vaultdrive.eu/oauth/authorize',
  token_endpoint: 'https://worf.vaultdrive.eu/oauth/token',
  scopes_supported: ['group.create']
};

const discoveryResponse = () => ({ok: true, status: 200, json: async () => METADATA});

const configureClient = () => {
  const {privateKey} = generateKeyPairSync('ec', {namedCurve: 'prime256v1'});
  process.env.WORF_OAUTH_CLIENT_ID = 'client-123';
  process.env.WORF_OAUTH_KID = 'kid-1';
  process.env.WORF_OAUTH_PRIVATE_KEY = privateKey.export({type: 'pkcs8', format: 'pem'}).toString();
};

describe('oauth-token', () => {
  const originalEnv = {...process.env};
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env = {...originalEnv, WORF_API_URL: 'https://worf.vaultdrive.eu'};
    delete process.env.WORF_OAUTH_CLIENT_ID;
    delete process.env.WORF_OAUTH_KID;
    delete process.env.WORF_OAUTH_PRIVATE_KEY;
    resetDiscoveryCache();
  });

  afterEach(() => {
    process.env = {...originalEnv};
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns server_error without posting when the client assertion cannot be built', async () => {
    const fetchMock = vi.fn().mockResolvedValue(discoveryResponse());
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await exchangeAuthorizationCode({
      code: 'abc',
      redirectUri: 'https://app.example/callback',
      codeVerifier: 'verifier'
    });

    expect(result.status).toBe(500);
    expect(result.data.error).toBe('server_error');
    expect(fetchMock.mock.calls.every(([, init]) => (init as RequestInit | undefined)?.method !== 'POST')).toBe(
      true
    );
  });

  it('posts a form-urlencoded authorization_code grant to the discovered token endpoint', async () => {
    configureClient();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(discoveryResponse())
      .mockResolvedValueOnce({
        status: 200,
        json: async () => ({access_token: 'at', refresh_token: 'rt', expires_in: 900})
      });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await exchangeAuthorizationCode({
      code: 'auth-code',
      redirectUri: 'https://app.example/callback',
      codeVerifier: 'verifier-value'
    });

    expect(result.status).toBe(200);
    expect(result.data.expires_in).toBe(900);

    const [url, init] = fetchMock.mock.calls[1];
    expect(url.toString()).toBe('https://worf.vaultdrive.eu/oauth/token');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/x-www-form-urlencoded');

    const body = new URLSearchParams(init.body as string);
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('auth-code');
    expect(body.get('redirect_uri')).toBe('https://app.example/callback');
    expect(body.get('code_verifier')).toBe('verifier-value');
    expect(body.get('client_assertion_type')).toBe('urn:ietf:params:oauth:client-assertion-type:jwt-bearer');
    expect(body.get('client_assertion')).toBeTruthy();
    expect(body.has('resource')).toBe(false);
    expect(body.has('client_secret')).toBe(false);
  });

  it('posts a refresh_token grant without scope or resource', async () => {
    configureClient();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(discoveryResponse())
      .mockResolvedValueOnce({status: 200, json: async () => ({access_token: 'at', refresh_token: 'rotated'})});
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await refreshWithOAuthToken('old-refresh-token');

    expect(result.data.refresh_token).toBe('rotated');

    const body = new URLSearchParams(fetchMock.mock.calls[1][1].body as string);
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe('old-refresh-token');
    expect(body.has('scope')).toBe(false);
    expect(body.has('resource')).toBe(false);
    expect(body.has('code')).toBe(false);
  });

  it('surfaces the standard OAuth error body and flags invalid_grant', async () => {
    configureClient();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(discoveryResponse())
      .mockResolvedValueOnce({
        status: 400,
        json: async () => ({error: 'invalid_grant', error_description: 'Refresh token has been revoked'})
      });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await refreshWithOAuthToken('reused-token');

    expect(result.status).toBe(400);
    expect(result.data.error).toBe('invalid_grant');
    expect(isInvalidGrant(result)).toBe(true);
  });

  it('reports a discovery outage as temporarily_unavailable instead of throwing', async () => {
    configureClient();
    global.fetch = vi
      .fn()
      .mockResolvedValue({ok: false, status: 503, json: async () => ({})}) as unknown as typeof fetch;

    const result = await refreshWithOAuthToken('token');

    expect(result.status).toBe(503);
    expect(result.data.error).toBe('temporarily_unavailable');
  });

  it('does not treat a missing refresh_token in the response as an error', async () => {
    configureClient();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(discoveryResponse())
      .mockResolvedValueOnce({status: 200, json: async () => ({access_token: 'at', expires_in: 900})});
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await exchangeAuthorizationCode({
      code: 'c',
      redirectUri: 'https://app.example/callback',
      codeVerifier: 'v'
    });

    expect(result.status).toBe(200);
    expect(result.data.refresh_token).toBeUndefined();
    expect(result.data.error).toBeUndefined();
  });
});
