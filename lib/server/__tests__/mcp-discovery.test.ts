import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {getMcpServers, resetMcpDiscoveryCache} from '../mcp-discovery';

const METADATA = {
  mcpServers: {
    worf: {url: 'https://worf.vaultdrive.eu/mcp'}
  }
};

describe('mcp-discovery', () => {
  const originalEnv = {...process.env};
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env = {...originalEnv, WORF_API_URL: 'https://worf.vaultdrive.eu'};
    resetMcpDiscoveryCache();
  });

  afterEach(() => {
    process.env = {...originalEnv};
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('fetches the .well-known/mcp document and maps it to a {name, url} list', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ok: true, status: 200, json: async () => METADATA});
    global.fetch = fetchMock as unknown as typeof fetch;

    const servers = await getMcpServers();

    expect(servers).toEqual([{name: 'worf', url: 'https://worf.vaultdrive.eu/mcp'}]);
    expect(fetchMock.mock.calls[0][0].toString()).toBe('https://worf.vaultdrive.eu/.well-known/mcp');
  });

  it('caches the metadata across calls', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ok: true, status: 200, json: async () => METADATA});
    global.fetch = fetchMock as unknown as typeof fetch;

    await getMcpServers();
    await getMcpServers();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws when the metadata document is unreachable', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue({ok: false, status: 503, json: async () => ({})}) as unknown as typeof fetch;

    await expect(getMcpServers()).rejects.toThrow(/discovery/i);
  });

  it('throws when the document has no mcpServers entries', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue({ok: true, status: 200, json: async () => ({mcpServers: {}})}) as unknown as typeof fetch;

    await expect(getMcpServers()).rejects.toThrow(/discovery/i);
  });
});
