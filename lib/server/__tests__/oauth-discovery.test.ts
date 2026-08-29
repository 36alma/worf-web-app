import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {buildAuthorizeScope, getAuthServerMetadata, resetDiscoveryCache} from '../oauth-discovery';

const METADATA = {
  issuer: 'https://worf.vaultdrive.eu',
  authorization_endpoint: 'https://worf.vaultdrive.eu/oauth/authorize',
  token_endpoint: 'https://worf.vaultdrive.eu/oauth/token',
  scopes_supported: ['group.create', 'post.get.global']
};

describe('oauth-discovery', () => {
  const originalEnv = {...process.env};
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env = {...originalEnv, WORF_API_URL: 'https://worf.vaultdrive.eu'};
    resetDiscoveryCache();
  });

  afterEach(() => {
    process.env = {...originalEnv};
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('fetches the RFC 8414 metadata document', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ok: true, status: 200, json: async () => METADATA});
    global.fetch = fetchMock as unknown as typeof fetch;

    const metadata = await getAuthServerMetadata();

    expect(metadata.issuer).toBe('https://worf.vaultdrive.eu');
    expect(metadata.token_endpoint).toBe('https://worf.vaultdrive.eu/oauth/token');
    expect(fetchMock.mock.calls[0][0].toString()).toBe(
      'https://worf.vaultdrive.eu/.well-known/oauth-authorization-server'
    );
  });

  it('caches the metadata across calls', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ok: true, status: 200, json: async () => METADATA});
    global.fetch = fetchMock as unknown as typeof fetch;

    await getAuthServerMetadata();
    await getAuthServerMetadata();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws when the metadata document is unreachable', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue({ok: false, status: 503, json: async () => ({})}) as unknown as typeof fetch;

    await expect(getAuthServerMetadata()).rejects.toThrow(/discovery/i);
  });

  it('throws when a required metadata field is missing', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({issuer: 'https://worf.vaultdrive.eu'})
    }) as unknown as typeof fetch;

    await expect(getAuthServerMetadata()).rejects.toThrow(/discovery/i);
  });

  it('builds a scope string with the pseudo scopes first and no duplicates', () => {
    const scope = buildAuthorizeScope({
      ...METADATA,
      scopes_supported: ['group.create', 'openid', 'group.create']
    });

    expect(scope.split(' ')).toEqual(['openid', 'profile', 'offline_access', 'group.create']);
  });

  it('builds a scope string even when the server advertises no scopes', () => {
    const scope = buildAuthorizeScope({...METADATA, scopes_supported: undefined});
    expect(scope).toBe('openid profile offline_access');
  });
});
