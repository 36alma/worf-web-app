export interface McpServerInfo {
  name: string;
  url: string;
}

type McpDiscoveryDocument = {
  mcpServers?: Record<string, {url?: string}>;
};

const CACHE_TTL_MS = 10 * 60 * 1000;

let cache: {value: McpServerInfo[]; fetchedAt: number} | null = null;

export function resetMcpDiscoveryCache(): void {
  cache = null;
}

/** Fetches the `.well-known/mcp` document and lists the account's MCP connection(s). */
export async function getMcpServers(): Promise<McpServerInfo[]> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.value;
  }

  const apiBase = process.env.WORF_API_URL;
  if (!apiBase) {
    throw new Error('MCP discovery failed: WORF_API_URL is not configured');
  }

  const discoveryUrl = new URL('/.well-known/mcp', apiBase.endsWith('/') ? apiBase : `${apiBase}/`);

  const response = await fetch(discoveryUrl, {cache: 'no-store'});
  if (!response.ok) {
    throw new Error(`MCP discovery failed: ${discoveryUrl.toString()} returned ${response.status}`);
  }

  const document = (await response.json().catch(() => ({}))) as McpDiscoveryDocument;
  const servers = Object.entries(document.mcpServers ?? {})
    .filter((entry): entry is [string, {url: string}] => typeof entry[1]?.url === 'string')
    .map(([name, {url}]) => ({name, url}));

  if (servers.length === 0) {
    throw new Error('MCP discovery failed: metadata document has no mcpServers entries');
  }

  cache = {value: servers, fetchedAt: Date.now()};
  return servers;
}
