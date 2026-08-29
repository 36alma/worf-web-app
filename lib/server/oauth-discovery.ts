export type AuthServerMetadata = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  scopes_supported?: string[];
};

// These are always grantable but are not advertised in scopes_supported, so they
// have to be requested explicitly. offline_access is what makes the server issue
// a refresh token at all.
const PSEUDO_SCOPES = ['openid', 'profile', 'offline_access'];

const CACHE_TTL_MS = 10 * 60 * 1000;

let cache: {value: AuthServerMetadata; fetchedAt: number} | null = null;

export function resetDiscoveryCache(): void {
  cache = null;
}

export async function getAuthServerMetadata(): Promise<AuthServerMetadata> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.value;
  }

  const apiBase = process.env.WORF_API_URL;
  if (!apiBase) {
    throw new Error('OAuth discovery failed: WORF_API_URL is not configured');
  }

  const discoveryUrl = new URL(
    '/.well-known/oauth-authorization-server',
    apiBase.endsWith('/') ? apiBase : `${apiBase}/`
  );

  const response = await fetch(discoveryUrl, {cache: 'no-store'});
  if (!response.ok) {
    throw new Error(`OAuth discovery failed: ${discoveryUrl.toString()} returned ${response.status}`);
  }

  const metadata = (await response.json().catch(() => ({}))) as Partial<AuthServerMetadata>;
  if (!metadata.issuer || !metadata.authorization_endpoint || !metadata.token_endpoint) {
    throw new Error('OAuth discovery failed: metadata document is missing required fields');
  }

  const value = metadata as AuthServerMetadata;
  cache = {value, fetchedAt: Date.now()};
  return value;
}

export function buildAuthorizeScope(metadata: AuthServerMetadata): string {
  const scopes = [...PSEUDO_SCOPES, ...(metadata.scopes_supported ?? [])];
  return Array.from(new Set(scopes)).join(' ');
}
