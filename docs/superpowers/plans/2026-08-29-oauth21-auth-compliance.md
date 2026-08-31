# OAuth 2.1 auth-megfelelőség — implementációs terv

> **Ügynök-végrehajtóknak:** KÖTELEZŐ AL-SKILL: `superpowers:subagent-driven-development` (ajánlott) vagy `superpowers:executing-plans` a taskonkénti végrehajtáshoz. A lépések checkbox (`- [ ]`) szintaxissal követhetők.

**Cél:** A worf-app OAuth-redirect bejelentkezését átállítani a szabványos `authorization_code` + PKCE (S256) flow-ra `private_key_jwt` kliens-hitelesítéssel, teljesíteni a backend 2026-08-28-i megfelelőségi körének kliensoldali követelményeit (`iss`, `offline_access`, `resource`, `insufficient_scope`, refresh-rotáció), és eltávolítani a holt legacy auth route-okat.

**Architektúra:** Csak szerveroldali Next.js route handlerek változnak. Új `lib/server/` modulok: PKCE-generátor, discovery-olvasó (cache-elt), `private_key_jwt` assertion-aláíró és form-urlencoded `/oauth/token` kliens. A login route böngésző-redirectet indít a backend által renderelt `/oauth/authorize`-ra; a callback ellenőrzi az `iss`-t és a `state`-et, majd beváltja a `code`-ot. A tokenek HttpOnly cookie-ban maradnak, a session eredetét egy `worf_auth_origin` cookie jelöli, hogy a refresh a megfelelő végpontra menjen.

**Tech Stack:** Next.js 16 App Router route handlerek, TypeScript, `jose` (új függőség) a JWT-aláíráshoz, Node beépített `crypto`/`fetch`, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-29-oauth21-auth-compliance-design.md`

## Globális megkötések

- Aláíró algoritmus: **ES256** (EC P-256). Az RS256/RSA ág nem része ennek a tervnek.
- A `client_assertion` élettartama: `exp - iat` soha nem lehet több 300 s-nál (a megvalósítás 60 s-ot használ), és minden hívás friss, egyedi `jti`-t kap (RFC 7523 replay-védelem). Aláírt assertiont soha nem cache-elünk.
- A `client_assertion` `aud` claimje pontosan a discovery `token_endpoint` értéke.
- **PKCE kötelező, kizárólag S256** — `plain` sehol nem jelenhet meg.
- **`resource` paramétert sehol nem küldünk** — sem az `/oauth/authorize`, sem az `/oauth/token` hívásban.
- A kért scope mindig tartalmazza az **`offline_access`**-t, különben nem jön refresh token.
- A privát kulcs (`WORF_OAUTH_PRIVATE_KEY`) kizárólag szerveroldali env-ből olvasható, csak `lib/server/*` fájlokban, soha nem kerül a böngészőbe és soha nem logoljuk teljes egészében.
- A `WORF_OAUTH_CLIENT_ID` **külön kliens** a `WORF_CLIENT_ID`-tól: az utóbbi a legacy jelszavas/logout végpontoké marad, a kettő soha nem keveredik.
- A legacy jelszavas backend-végpontokat (`/v1/auth/login`, `/v1/auth/multi-factor-authentication`) nem módosítjuk.
- Minden task végén `npx tsc --noEmit` hibátlan.

---

## Task 1: PKCE helper

**Fájlok:**
- Létrehoz: `lib/server/pkce.ts`
- Teszt: `lib/server/__tests__/pkce.test.ts`

**Interfészek:**
- Fogyaszt: semmit korábbi taskból.
- Előállít: `generateCodeVerifier(): string`, `generateCodeChallenge(codeVerifier: string): string`, `generatePkcePair(): {codeVerifier: string; codeChallenge: string}`, `generateState(): string`, `PkcePair` típus.

- [x] **1. lépés: Írd meg a bukó teszteket**

```typescript
// lib/server/__tests__/pkce.test.ts
import {createHash} from 'node:crypto';
import {describe, expect, it} from 'vitest';
import {generateCodeChallenge, generateCodeVerifier, generatePkcePair, generateState} from '../pkce';

describe('pkce', () => {
  it('generates a code verifier with base64url charset and a valid length', () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
  });

  it('derives the code challenge as the base64url SHA-256 of the verifier', () => {
    const verifier = 'test-verifier-value';
    const expected = createHash('sha256')
      .update(verifier)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    expect(generateCodeChallenge(verifier)).toBe(expected);
  });

  it('generatePkcePair returns a matching verifier/challenge pair', () => {
    const {codeVerifier, codeChallenge} = generatePkcePair();
    expect(generateCodeChallenge(codeVerifier)).toBe(codeChallenge);
  });

  it('returns a different pair on every call', () => {
    expect(generatePkcePair().codeVerifier).not.toBe(generatePkcePair().codeVerifier);
  });

  it('generates a non-empty base64url state value', () => {
    const state = generateState();
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(state.length).toBeGreaterThan(0);
  });
});
```

- [x] **2. lépés: Futtasd, ellenőrizd, hogy bukik**

Futtatás: `npx vitest run lib/server/__tests__/pkce.test.ts`
Várt: FAIL — `Cannot find module '../pkce'`.

- [x] **3. lépés: Írd meg a `lib/server/pkce.ts`-t**

```typescript
import {createHash, randomBytes} from 'node:crypto';

export type PkcePair = {
  codeVerifier: string;
  codeChallenge: string;
};

const base64UrlEncode = (input: Buffer): string =>
  input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export const generateCodeVerifier = (): string => base64UrlEncode(randomBytes(32));

export const generateCodeChallenge = (codeVerifier: string): string =>
  base64UrlEncode(createHash('sha256').update(codeVerifier).digest());

export const generatePkcePair = (): PkcePair => {
  const codeVerifier = generateCodeVerifier();
  return {codeVerifier, codeChallenge: generateCodeChallenge(codeVerifier)};
};

export const generateState = (): string => base64UrlEncode(randomBytes(16));
```

- [x] **4. lépés: Futtasd, ellenőrizd, hogy átmegy**

Futtatás: `npx vitest run lib/server/__tests__/pkce.test.ts`
Várt: PASS (5 teszt).

- [x] **5. lépés: Commit**

```bash
git add lib/server/pkce.ts lib/server/__tests__/pkce.test.ts
git commit -m "feat: add PKCE code verifier/challenge helper"
```

---

## Task 2: Discovery-olvasó és scope-építő

**Fájlok:**
- Létrehoz: `lib/server/oauth-discovery.ts`
- Teszt: `lib/server/__tests__/oauth-discovery.test.ts`

**Interfészek:**
- Fogyaszt: semmit korábbi taskból (`process.env.WORF_API_URL`-t olvas).
- Előállít:
  - `type AuthServerMetadata = {issuer: string; authorization_endpoint: string; token_endpoint: string; scopes_supported?: string[]}`
  - `getAuthServerMetadata(): Promise<AuthServerMetadata>` — dob `Error`-t, ha a `WORF_API_URL` hiányzik, ha a válasz nem 2xx, vagy ha bármelyik kötelező mező hiányzik. Sikeres letöltés után 10 percig memóriában cache-el.
  - `buildAuthorizeScope(metadata: AuthServerMetadata): string` — `openid profile offline_access` + `scopes_supported`, duplikátumok nélkül, szóközzel elválasztva.
  - `resetDiscoveryCache(): void` — csak tesztekhez.

- [x] **1. lépés: Írd meg a bukó teszteket**

```typescript
// lib/server/__tests__/oauth-discovery.test.ts
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
    global.fetch = vi.fn().mockResolvedValue({ok: false, status: 503, json: async () => ({})}) as unknown as typeof fetch;
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
```

- [x] **2. lépés: Futtasd, ellenőrizd, hogy bukik**

Futtatás: `npx vitest run lib/server/__tests__/oauth-discovery.test.ts`
Várt: FAIL — `Cannot find module '../oauth-discovery'`.

- [x] **3. lépés: Írd meg a `lib/server/oauth-discovery.ts`-t**

```typescript
export type AuthServerMetadata = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  scopes_supported?: string[];
};

// The pseudo scopes are always grantable but are not advertised in
// scopes_supported, so they have to be requested explicitly. offline_access is
// what makes the server issue a refresh token at all.
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
```

- [x] **4. lépés: Futtasd, ellenőrizd, hogy átmegy**

Futtatás: `npx vitest run lib/server/__tests__/oauth-discovery.test.ts`
Várt: PASS (6 teszt).

- [x] **5. lépés: Commit**

```bash
git add lib/server/oauth-discovery.ts lib/server/__tests__/oauth-discovery.test.ts
git commit -m "feat: read OAuth authorization server metadata from discovery"
```

---

## Task 3: `private_key_jwt` client assertion aláíró

**Fájlok:**
- Módosít: `package.json`, `package-lock.json` (a `jose` függőség)
- Létrehoz: `lib/server/oauth-client-assertion.ts`
- Teszt: `lib/server/__tests__/oauth-client-assertion.test.ts`

**Interfészek:**
- Fogyaszt: semmit korábbi taskból (`process.env`-ből olvas: `WORF_OAUTH_CLIENT_ID`, `WORF_OAUTH_PRIVATE_KEY`, `WORF_OAUTH_KID`).
- Előállít: `buildClientAssertion(audience: string): Promise<string | null>` (`null`, ha bármelyik env-változó hiányzik), `CLIENT_ASSERTION_TYPE = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer'`.

Az `audience` paraméter a Task 2 discovery `token_endpoint`-jából érkezik — a modul **nem** épít maga URL-t.

- [x] **1. lépés: Telepítsd a `jose`-t**

Futtatás: `npm install jose`
Várt: a `package.json` `dependencies` blokkjában megjelenik a `jose`.

- [x] **2. lépés: Írd meg a bukó teszteket**

```typescript
// lib/server/__tests__/oauth-client-assertion.test.ts
import {generateKeyPairSync} from 'node:crypto';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {importSPKI, jwtVerify} from 'jose';
import {buildClientAssertion, CLIENT_ASSERTION_TYPE} from '../oauth-client-assertion';

const AUDIENCE = 'https://worf.vaultdrive.eu/oauth/token';

describe('buildClientAssertion', () => {
  const originalEnv = {...process.env};
  let publicKeyPem: string;

  beforeEach(() => {
    const {privateKey, publicKey} = generateKeyPairSync('ec', {namedCurve: 'prime256v1'});
    publicKeyPem = publicKey.export({type: 'spki', format: 'pem'}).toString();

    process.env.WORF_OAUTH_CLIENT_ID = 'test-client-id';
    process.env.WORF_OAUTH_KID = 'test-kid';
    process.env.WORF_OAUTH_PRIVATE_KEY = privateKey.export({type: 'pkcs8', format: 'pem'}).toString();
  });

  afterEach(() => {
    process.env = {...originalEnv};
  });

  it('exposes the RFC 7523 client-assertion-type constant', () => {
    expect(CLIENT_ASSERTION_TYPE).toBe('urn:ietf:params:oauth:client-assertion-type:jwt-bearer');
  });

  it('signs a JWT with the required claims, a TTL under 300s, and the given audience', async () => {
    const assertion = await buildClientAssertion(AUDIENCE);
    expect(assertion).not.toBeNull();

    const publicKey = await importSPKI(publicKeyPem, 'ES256');
    const {payload, protectedHeader} = await jwtVerify(assertion as string, publicKey, {audience: AUDIENCE});

    expect(protectedHeader.kid).toBe('test-kid');
    expect(protectedHeader.alg).toBe('ES256');
    expect(payload.iss).toBe('test-client-id');
    expect(payload.sub).toBe('test-client-id');
    expect(typeof payload.jti).toBe('string');
    expect((payload.jti as string).length).toBeGreaterThan(0);
    expect((payload.exp as number) - (payload.iat as number)).toBeLessThanOrEqual(300);
  });

  it('produces a different jti on every call', async () => {
    const first = (await buildClientAssertion(AUDIENCE)) as string;
    const second = (await buildClientAssertion(AUDIENCE)) as string;
    const decode = (token: string) => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    expect(decode(first).jti).not.toBe(decode(second).jti);
  });

  it('accepts a PEM stored with escaped newlines', async () => {
    process.env.WORF_OAUTH_PRIVATE_KEY = (process.env.WORF_OAUTH_PRIVATE_KEY as string).replace(/\n/g, '\\n');
    await expect(buildClientAssertion(AUDIENCE)).resolves.toEqual(expect.any(String));
  });

  it('returns null when a required env var is missing', async () => {
    delete process.env.WORF_OAUTH_KID;
    await expect(buildClientAssertion(AUDIENCE)).resolves.toBeNull();
  });
});
```

- [x] **3. lépés: Futtasd, ellenőrizd, hogy bukik**

Futtatás: `npx vitest run lib/server/__tests__/oauth-client-assertion.test.ts`
Várt: FAIL — `Cannot find module '../oauth-client-assertion'`.

- [x] **4. lépés: Írd meg a `lib/server/oauth-client-assertion.ts`-t**

```typescript
import {randomUUID} from 'node:crypto';
import {importPKCS8, SignJWT} from 'jose';

export const CLIENT_ASSERTION_TYPE = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer';

// RFC 7523 allows up to 300s; a short window keeps the replay surface small.
const CLIENT_ASSERTION_TTL_SECONDS = 60;

export async function buildClientAssertion(audience: string): Promise<string | null> {
  const clientId = process.env.WORF_OAUTH_CLIENT_ID;
  const privateKeyPem = process.env.WORF_OAUTH_PRIVATE_KEY;
  const kid = process.env.WORF_OAUTH_KID;

  if (!clientId || !privateKeyPem || !kid || !audience) {
    return null;
  }

  const privateKey = await importPKCS8(privateKeyPem.replace(/\\n/g, '\n'), 'ES256');
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({iss: clientId, sub: clientId})
    .setProtectedHeader({alg: 'ES256', kid, typ: 'JWT'})
    .setIssuedAt(now)
    .setExpirationTime(now + CLIENT_ASSERTION_TTL_SECONDS)
    .setAudience(audience)
    .setJti(randomUUID())
    .sign(privateKey);
}
```

- [x] **5. lépés: Futtasd, ellenőrizd, hogy átmegy**

Futtatás: `npx vitest run lib/server/__tests__/oauth-client-assertion.test.ts`
Várt: PASS (5 teszt).

- [x] **6. lépés: Commit**

```bash
git add package.json package-lock.json lib/server/oauth-client-assertion.ts lib/server/__tests__/oauth-client-assertion.test.ts
git commit -m "feat: sign private_key_jwt client assertions with jose"
```

---

## Task 4: Form-urlencoded `/oauth/token` kliens

**Fájlok:**
- Létrehoz: `lib/server/oauth-token.ts`
- Teszt: `lib/server/__tests__/oauth-token.test.ts`

**Interfészek:**
- Fogyaszt: `getAuthServerMetadata()` (Task 2), `buildClientAssertion()`, `CLIENT_ASSERTION_TYPE` (Task 3).
- Előállít:
  - `type OAuthTokenResult = {status: number; data: {access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error?: string; error_description?: string; [key: string]: unknown}}`
  - `exchangeAuthorizationCode(params: {code: string; redirectUri: string; codeVerifier: string}): Promise<OAuthTokenResult>`
  - `refreshWithOAuthToken(refreshToken: string): Promise<OAuthTokenResult>`
  - `isInvalidGrant(result: OAuthTokenResult): boolean` — igaz, ha a válasz `error` mezője `invalid_grant`.

Egyik függvény sem küld `resource` paramétert, és a `refresh` ág nem küld `scope`-ot (nem akarunk szűkíteni).

- [x] **1. lépés: Írd meg a bukó teszteket**

```typescript
// lib/server/__tests__/oauth-token.test.ts
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
    // Only the discovery request may have happened; no POST to the token endpoint.
    expect(fetchMock.mock.calls.every(([, init]) => (init as RequestInit | undefined)?.method !== 'POST')).toBe(true);
  });

  it('posts a form-urlencoded authorization_code grant to the discovered token endpoint', async () => {
    configureClient();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(discoveryResponse())
      .mockResolvedValueOnce({status: 200, json: async () => ({access_token: 'at', refresh_token: 'rt', expires_in: 900})});
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
    global.fetch = vi.fn().mockResolvedValue({ok: false, status: 503, json: async () => ({})}) as unknown as typeof fetch;

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
```

- [x] **2. lépés: Futtasd, ellenőrizd, hogy bukik**

Futtatás: `npx vitest run lib/server/__tests__/oauth-token.test.ts`
Várt: FAIL — `Cannot find module '../oauth-token'`.

- [x] **3. lépés: Írd meg a `lib/server/oauth-token.ts`-t**

```typescript
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

  // No resource parameter is ever sent: the authorization request omits it too,
  // so the server applies its default and invalid_target cannot occur.
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
  return postOAuthToken({
    grant_type: 'refresh_token',
    refresh_token: refreshToken
  });
}
```

- [x] **4. lépés: Futtasd, ellenőrizd, hogy átmegy**

Futtatás: `npx vitest run lib/server/__tests__/oauth-token.test.ts`
Várt: PASS (6 teszt).

- [x] **5. lépés: Commit**

```bash
git add lib/server/oauth-token.ts lib/server/__tests__/oauth-token.test.ts
git commit -m "feat: add form-urlencoded /oauth/token client with client assertion"
```

---

## Task 5: Cookie-réteg — új konstansok és `expires_in`-alapú élettartam

**Fájlok:**
- Módosít: `lib/utils/constants.ts` (bővítés, a meglévő négy export változatlan)
- Módosít: `lib/server/auth.ts` (`setAuthCookies` és `clearAuthCookies`)
- Módosít: `lib/utils/cookies.ts` (új olvasó)
- Teszt: `lib/utils/__tests__/constants.test.ts`

**Interfészek:**
- Előállít:
  - `PKCE_VERIFIER_COOKIE = 'worf_pkce_verifier'`, `PKCE_STATE_COOKIE = 'worf_pkce_state'`, `AUTH_ORIGIN_COOKIE = 'worf_auth_origin'`, `OAUTH_AUTH_ORIGIN = 'oauth'`
  - `PKCE_COOKIE_OPTIONS` (`AUTH_COOKIE_OPTIONS` + `maxAge: 600`), `AUTH_ORIGIN_COOKIE_OPTIONS` (`AUTH_COOKIE_OPTIONS` + `maxAge: 60*60*24*30`)
  - `ACCESS_TOKEN_FALLBACK_TTL_SECONDS = 900`, `resolveAccessTokenMaxAge(expiresIn?: number): number`
  - `setAuthCookies` új opcionális `expires_in` mezője; `clearAuthCookies` az `AUTH_ORIGIN_COOKIE`-t is törli
  - `getServerAuthOrigin(): Promise<string | undefined>` a `lib/utils/cookies.ts`-ben

- [x] **1. lépés: Írd meg a bukó teszteket**

```typescript
// lib/utils/__tests__/constants.test.ts
import {describe, expect, it} from 'vitest';
import {
  ACCESS_TOKEN_FALLBACK_TTL_SECONDS,
  AUTH_ORIGIN_COOKIE,
  AUTH_ORIGIN_COOKIE_OPTIONS,
  OAUTH_AUTH_ORIGIN,
  PKCE_COOKIE_OPTIONS,
  PKCE_STATE_COOKIE,
  PKCE_VERIFIER_COOKIE,
  resolveAccessTokenMaxAge
} from '../constants';

describe('OAuth cookie constants', () => {
  it('defines distinct cookie names for PKCE verifier, PKCE state, and auth origin', () => {
    const names = [PKCE_VERIFIER_COOKIE, PKCE_STATE_COOKIE, AUTH_ORIGIN_COOKIE];
    expect(new Set(names).size).toBe(names.length);
    expect(PKCE_VERIFIER_COOKIE).toBe('worf_pkce_verifier');
    expect(PKCE_STATE_COOKIE).toBe('worf_pkce_state');
    expect(AUTH_ORIGIN_COOKIE).toBe('worf_auth_origin');
    expect(OAUTH_AUTH_ORIGIN).toBe('oauth');
  });

  it('sets a short lifetime for PKCE cookies and httpOnly on both option sets', () => {
    expect(PKCE_COOKIE_OPTIONS.maxAge).toBe(600);
    expect(PKCE_COOKIE_OPTIONS.httpOnly).toBe(true);
    expect(AUTH_ORIGIN_COOKIE_OPTIONS.maxAge).toBe(60 * 60 * 24 * 30);
    expect(AUTH_ORIGIN_COOKIE_OPTIONS.httpOnly).toBe(true);
  });
});

describe('resolveAccessTokenMaxAge', () => {
  it('falls back to 900 seconds when expires_in is absent or unusable', () => {
    expect(ACCESS_TOKEN_FALLBACK_TTL_SECONDS).toBe(900);
    expect(resolveAccessTokenMaxAge(undefined)).toBe(900);
    expect(resolveAccessTokenMaxAge(0)).toBe(900);
    expect(resolveAccessTokenMaxAge(-10)).toBe(900);
    expect(resolveAccessTokenMaxAge(Number.NaN)).toBe(900);
  });

  it('uses the advertised lifetime when it is sane', () => {
    expect(resolveAccessTokenMaxAge(900)).toBe(900);
    expect(resolveAccessTokenMaxAge(3600)).toBe(3600);
  });

  it('caps absurd lifetimes at one day', () => {
    expect(resolveAccessTokenMaxAge(60 * 60 * 24 * 30)).toBe(60 * 60 * 24);
  });
});
```

- [x] **2. lépés: Futtasd, ellenőrizd, hogy bukik**

Futtatás: `npx vitest run lib/utils/__tests__/constants.test.ts`
Várt: FAIL — az új named exportok nem léteznek.

- [x] **3. lépés: Bővítsd a `lib/utils/constants.ts`-t**

Fűzd a fájl végére (a meglévő négy exportot ne módosítsd):

```typescript
export const PKCE_VERIFIER_COOKIE = 'worf_pkce_verifier';
export const PKCE_STATE_COOKIE = 'worf_pkce_state';
export const AUTH_ORIGIN_COOKIE = 'worf_auth_origin';
export const OAUTH_AUTH_ORIGIN = 'oauth';

export const PKCE_COOKIE_OPTIONS = {
  ...AUTH_COOKIE_OPTIONS,
  maxAge: 60 * 10
};

export const AUTH_ORIGIN_COOKIE_OPTIONS = {
  ...AUTH_COOKIE_OPTIONS,
  maxAge: 60 * 60 * 24 * 30
};

export const ACCESS_TOKEN_FALLBACK_TTL_SECONDS = 900;

const ACCESS_TOKEN_MAX_TTL_SECONDS = 60 * 60 * 24;

// The access cookie should expire with the token it holds: the server advertises
// expires_in (900s today), and a longer cookie only buys pointless 401 round trips.
export const resolveAccessTokenMaxAge = (expiresIn?: number): number => {
  if (typeof expiresIn !== 'number' || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    return ACCESS_TOKEN_FALLBACK_TTL_SECONDS;
  }

  return Math.min(Math.floor(expiresIn), ACCESS_TOKEN_MAX_TTL_SECONDS);
};
```

- [x] **4. lépés: Futtasd, ellenőrizd, hogy átmegy**

Futtatás: `npx vitest run lib/utils/__tests__/constants.test.ts`
Várt: PASS (5 teszt).

- [x] **5. lépés: Kösd be a `lib/server/auth.ts`-be**

Cseréld a fájl tartalmát erre (a `jsonWithStatus` változatlan marad):

```typescript
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';
import {
  ACCESS_COOKIE,
  AUTH_COOKIE_OPTIONS,
  AUTH_ORIGIN_COOKIE,
  MFA_COOKIE,
  REFRESH_COOKIE,
  resolveAccessTokenMaxAge
} from '@/lib/utils/constants';

type Tokens = {
  access_token?: string;
  refresh_token?: string;
  multi_factor_token?: string;
  expires_in?: number;
};

export async function setAuthCookies(tokens: Tokens) {
  const jar = await cookies();

  if (tokens.access_token) {
    jar.set(ACCESS_COOKIE, tokens.access_token, {
      ...AUTH_COOKIE_OPTIONS,
      maxAge: resolveAccessTokenMaxAge(tokens.expires_in)
    });
  }

  if (tokens.refresh_token) {
    jar.set(REFRESH_COOKIE, tokens.refresh_token, {
      ...AUTH_COOKIE_OPTIONS,
      maxAge: 60 * 60 * 24 * 30
    });
  }

  if (tokens.multi_factor_token) {
    jar.set(MFA_COOKIE, tokens.multi_factor_token, {
      ...AUTH_COOKIE_OPTIONS,
      maxAge: 60 * 10
    });
  } else {
    jar.delete(MFA_COOKIE);
  }
}

export async function clearAuthCookies() {
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
  jar.delete(MFA_COOKIE);
  jar.delete(AUTH_ORIGIN_COOKIE);
}

export function jsonWithStatus(payload: unknown, status: number) {
  return NextResponse.json(payload, {status});
}
```

- [x] **6. lépés: Adj hozzá egy olvasót a `lib/utils/cookies.ts`-hez**

Fűzd a fájl végére, és bővítsd az importot `AUTH_ORIGIN_COOKIE`-val:

```typescript
export const getServerAuthOrigin = async () => (await cookies()).get(AUTH_ORIGIN_COOKIE)?.value;
```

- [x] **7. lépés: Típusellenőrzés**

Futtatás: `npx tsc --noEmit`
Várt: nincs hiba.

- [x] **8. lépés: Commit**

```bash
git add lib/utils/constants.ts lib/utils/__tests__/constants.test.ts lib/server/auth.ts lib/utils/cookies.ts
git commit -m "feat: add PKCE/auth-origin cookies and expires_in-based access cookie TTL"
```

---

## Task 6: Kliens-regisztrációs script és env-dokumentáció

**Fájlok:**
- Létrehoz: `scripts/register-oauth-client.mjs`
- Módosít: `package.json` (`scripts` blokk), `.env`, `.env.local.example`

**Interfészek:**
- Fogyaszt: semmit (önálló Node script, az alkalmazás nem importálja).
- Előállít: egy CLI, amely ES256 kulcspárt generál, kiszámol egy RFC 7638 JWK-thumbprint `kid`-et, és `--dry-run` nélkül regisztrál egy `private_key_jwt` klienst a `POST {WORF_API_URL}/oauth/register`-en.

**FONTOS:** ez a script valódi kliens-regisztrációt hoz létre a backendben. `--dry-run` nélkül csak a felhasználó kifejezett kérésére futtatható.

- [x] **1. lépés: Írd meg a `scripts/register-oauth-client.mjs`-t**

```javascript
#!/usr/bin/env node
import {webcrypto} from 'node:crypto';

const {subtle} = webcrypto;

function base64url(buffer) {
  return Buffer.from(buffer).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function derToPem(der, label) {
  const base64 = der.toString('base64');
  const lines = base64.match(/.{1,64}/g) ?? [];
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----\n`;
}

async function computeJwkThumbprint(jwk) {
  // RFC 7638: only the required members, lexicographically ordered, no whitespace.
  const ordered = {crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y};
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(ordered)));
  return base64url(digest);
}

async function generateKeyMaterial() {
  const keyPair = await subtle.generateKey({name: 'ECDSA', namedCurve: 'P-256'}, true, ['sign', 'verify']);
  const publicJwk = await subtle.exportKey('jwk', keyPair.publicKey);
  const pkcs8 = await subtle.exportKey('pkcs8', keyPair.privateKey);
  const privateKeyPem = derToPem(Buffer.from(pkcs8), 'PRIVATE KEY');
  const kid = await computeJwkThumbprint(publicJwk);

  delete publicJwk.key_ops;
  delete publicJwk.ext;

  return {publicJwk: {...publicJwk, kid, use: 'sig', alg: 'ES256'}, privateKeyPem, kid};
}

function parseArgs(argv) {
  const args = {dryRun: false, clientName: 'Worf Frontend (private_key_jwt)', redirectUris: []};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--redirect-uri') args.redirectUris.push(argv[(i += 1)]);
    else if (arg === '--client-name') args.clientName = argv[(i += 1)];
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apiBase = process.env.WORF_API_URL;

  if (!args.dryRun && !apiBase) {
    console.error('WORF_API_URL is not set. Set it in your environment or pass --dry-run.');
    process.exitCode = 1;
    return;
  }

  if (args.redirectUris.length === 0 && process.env.WORF_OAUTH_REDIRECT_URI) {
    args.redirectUris.push(process.env.WORF_OAUTH_REDIRECT_URI);
  }

  if (!args.dryRun && args.redirectUris.length === 0) {
    console.error('Provide at least one --redirect-uri or set WORF_OAUTH_REDIRECT_URI.');
    process.exitCode = 1;
    return;
  }

  const {publicJwk, privateKeyPem, kid} = await generateKeyMaterial();

  const registrationPayload = {
    client_name: args.clientName,
    redirect_uris: args.redirectUris,
    token_endpoint_auth_method: 'private_key_jwt',
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    jwks: {keys: [publicJwk]}
  };

  console.log('Generated JWK (public):');
  console.log(JSON.stringify(publicJwk, null, 2));
  console.log('\nGenerated private key (PEM, keep secret, never commit):');
  console.log(privateKeyPem);
  console.log(`kid: ${kid}`);

  if (args.dryRun) {
    console.log('\n--dry-run set, skipping registration. Payload that would be sent to /oauth/register:');
    console.log(JSON.stringify(registrationPayload, null, 2));
    return;
  }

  const registerUrl = new URL('/oauth/register', apiBase.endsWith('/') ? apiBase : `${apiBase}/`);
  const response = await fetch(registerUrl, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(registrationPayload)
  });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error(`\nRegistration failed (${response.status}):`, body);
    process.exitCode = 1;
    return;
  }

  console.log(`\nRegistration succeeded. client_id: ${body.client_id}`);
  console.log('\nAdd these to .env (a separate client from WORF_CLIENT_ID, which stays as-is):');
  console.log(`WORF_OAUTH_CLIENT_ID=${body.client_id}`);
  console.log(`WORF_OAUTH_KID=${kid}`);
  console.log(`WORF_OAUTH_PRIVATE_KEY=${privateKeyPem.replace(/\n/g, '\\n')}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
```

- [x] **2. lépés: Vedd fel az npm scriptet**

A `package.json` `"scripts"` blokkjába, a `"test:watch"` sor után:

```json
    "register-oauth-client": "node scripts/register-oauth-client.mjs"
```

- [x] **3. lépés: Futtasd dry-run módban**

Futtatás: `node scripts/register-oauth-client.mjs --dry-run --redirect-uri http://localhost:3000/api/auth/oauth/callback`
Várt: kiír egy `Generated JWK (public):` blokkot `"kty": "EC"` és `"crv": "P-256"` mezőkkel, egy `-----BEGIN PRIVATE KEY-----` blokkot, egy `kid:` sort, végül a `--dry-run set, skipping registration.` üzenetet a payloaddal. Hálózati hívás nem történik.

- [x] **4. lépés: Frissítsd a `.env.local.example`-t**

```
WORF_API_URL=https://api.yourworfserver.com
WORF_CLIENT_ID=your-legacy-password-flow-client-uuid
WORF_CLIENT_SECRET=your-legacy-password-flow-client-secret
WORF_OAUTH_CLIENT_ID=your-private-key-jwt-client-uuid
WORF_OAUTH_PRIVATE_KEY=your-pkcs8-pem-private-key-with-literal-\n-line-breaks
WORF_OAUTH_KID=your-registered-jwk-kid
WORF_OAUTH_REDIRECT_URI=http://localhost:3000/api/auth/oauth/callback
WORF_DEVICE_TYPE=web

NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_DEFAULT_LOCALE=hu
NEXT_PUBLIC_API_PROXY_URL=/api/proxy
```

A `WORF_CLIENT_ID`/`WORF_CLIENT_SECRET` és a `WORF_OAUTH_*` **két külön, egymástól függetlenül regisztrált kliens**. Ne vond össze őket.

- [x] **5. lépés: Vedd fel az üres kulcsokat a helyi `.env`-be**

A meglévő `WORF_CLIENT_SECRET` sor után (a `WORF_CLIENT_ID`/`WORF_CLIENT_SECRET` sorokat ne töröld — a logout route-nak kellenek):

```
WORF_OAUTH_CLIENT_ID=
WORF_OAUTH_PRIVATE_KEY=
WORF_OAUTH_KID=
```

Mindhárom üresen marad addig, amíg a script éles futtatása meg nem történt és az értékek be nem másolódtak.

- [x] **6. lépés: Ellenőrzés**

Futtatás: `grep -c "WORF_OAUTH_" .env .env.local.example`
Várt: mindkét fájlnál `4` (`WORF_OAUTH_CLIENT_ID`, `WORF_OAUTH_PRIVATE_KEY`, `WORF_OAUTH_KID`, `WORF_OAUTH_REDIRECT_URI`).

- [x] **7. lépés: Commit**

```bash
git add scripts/register-oauth-client.mjs package.json .env.local.example
git commit -m "feat: add private_key_jwt client registration script"
```

Megjegyzés: a `.env` git-ignorált (`.gitignore:37`), ezért csak a `.env.local.example` kerül commitba.

---

## Task 7: Login route — PKCE-alapú `/oauth/authorize` redirect

**Fájlok:**
- Módosít: `app/api/auth/oauth/login/route.ts` (a `GET` handler teljes újraírása)

**Interfészek:**
- Fogyaszt: `generatePkcePair()`, `generateState()` (Task 1); `getAuthServerMetadata()`, `buildAuthorizeScope()` (Task 2); `PKCE_VERIFIER_COOKIE`, `PKCE_STATE_COOKIE`, `PKCE_COOKIE_OPTIONS` (Task 5).
- Előállít: beállítja a PKCE cookie-kat, amelyeket a Task 8 callbackje olvas.

- [x] **1. lépés: Cseréld a fájl teljes tartalmát**

```typescript
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
  // No client_secret and no resource parameter by design.

  return NextResponse.redirect(authorizeUrl);
}
```

- [x] **2. lépés: Típusellenőrzés és lint**

Futtatás: `npx tsc --noEmit` és `npm run lint`
Várt: nincs új hiba ehhez a fájlhoz.

- [x] **3. lépés: Ellenőrizd, hogy eltűnt a secret-szivárgás**

Futtatás: `grep -rn "client_secret" app/api/auth/oauth/`
Várt: nincs találat.

- [x] **4. lépés: Commit**

```bash
git add app/api/auth/oauth/login/route.ts
git commit -m "feat: redirect to PKCE-based /oauth/authorize without client_secret"
```

---

## Task 8: Callback route — `iss`/`state` ellenőrzés és code-csere

**Fájlok:**
- Módosít: `app/api/auth/oauth/callback/route.ts` (a `GET` handler teljes újraírása)

**Interfészek:**
- Fogyaszt: `setAuthCookies` (`lib/server/auth.ts`, Task 5); `exchangeAuthorizationCode` (Task 4); `getAuthServerMetadata` (Task 2); `AUTH_ORIGIN_COOKIE`, `AUTH_ORIGIN_COOKIE_OPTIONS`, `OAUTH_AUTH_ORIGIN`, `PKCE_STATE_COOKIE`, `PKCE_VERIFIER_COOKIE` (Task 5).
- Előállít: beállítja az `AUTH_ORIGIN_COOKIE=oauth`-t, amelyet a Task 9 refresh route-ja olvas.

Az ellenőrzési sorrend kötött: **`iss` először**, még a `error` és a `state` feldolgozása előtt (RFC 9207 — az `iss` a hibaágon is megérkezik).

- [x] **1. lépés: Cseréld a fájl teljes tartalmát**

```typescript
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

  // RFC 9207: validate the issuer before touching anything else in the response,
  // including the error branch — a mix-up attack can forge either one.
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
    // narrowed the grant: the session will end when the access token expires.
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
```

- [x] **2. lépés: Típusellenőrzés és lint**

Futtatás: `npx tsc --noEmit` és `npm run lint`
Várt: nincs új hiba ehhez a fájlhoz.

- [x] **3. lépés: Ellenőrizd, hogy nincs token a query-ből olvasva**

Futtatás: `grep -n "access_token" app/api/auth/oauth/callback/route.ts`
Várt: az `access_token` csak a token-válasz (`data.access_token`) kontextusában szerepel, `searchParams.get('access_token')` nem fordul elő.

- [x] **4. lépés: Commit**

```bash
git add app/api/auth/oauth/callback/route.ts
git commit -m "feat: validate iss and state, exchange code via /oauth/token"
```

---

## Task 9: Refresh route — a session eredete szerinti útválasztás

**Fájlok:**
- Módosít: `app/api/auth/token/route.ts` (a `refreshAccessToken` és az importok; a `sanitizeRedirectPath`, `POST`, `GET` változatlan)

**Interfészek:**
- Fogyaszt: `refreshWithOAuthToken`, `isInvalidGrant` (Task 4); `AUTH_ORIGIN_COOKIE`, `AUTH_ORIGIN_COOKIE_OPTIONS`, `OAUTH_AUTH_ORIGIN` (Task 5); a meglévő `getAuthClientPayload`, `MISSING_AUTH_CLIENT_MESSAGE`, `callWorfApi`, `clearAuthCookies`, `setAuthCookies`, `getServerRefreshToken`, `getServerAuthOrigin`.

- [x] **1. lépés: Cseréld az importokat és a `refreshAccessToken`-t**

A fájl elejét (az importoktól a `refreshAccessToken` végéig) cseréld erre:

```typescript
import {NextRequest, NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {clearAuthCookies, jsonWithStatus, setAuthCookies} from '@/lib/server/auth';
import {getAuthClientPayload, MISSING_AUTH_CLIENT_MESSAGE} from '@/lib/server/auth-client';
import {isInvalidGrant, refreshWithOAuthToken} from '@/lib/server/oauth-token';
import {callWorfApi} from '@/lib/server/worf';
import {AUTH_ORIGIN_COOKIE, AUTH_ORIGIN_COOKIE_OPTIONS, OAUTH_AUTH_ORIGIN} from '@/lib/utils/constants';
import {getServerAuthOrigin, getServerRefreshToken} from '@/lib/utils/cookies';

const parseScopes = () =>
  (process.env.WORF_SCOPES ?? '')
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean);

type RefreshResult = {
  status: number;
  data: unknown;
};

async function refreshOAuthSession(refreshToken: string): Promise<RefreshResult> {
  const result = await refreshWithOAuthToken(refreshToken);
  const {status, data} = result;

  if (status >= 200 && status < 300 && data.access_token) {
    // The refresh token rotates on every use: whatever came back replaces the
    // stored one, and the old value is already dead server-side.
    await setAuthCookies({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in
    });

    const jar = await cookies();
    jar.set(AUTH_ORIGIN_COOKIE, OAUTH_AUTH_ORIGIN, AUTH_ORIGIN_COOKIE_OPTIONS);

    return {status, data};
  }

  // invalid_grant means the token was expired, already used, or its whole
  // rotation chain was revoked after a reuse. Retrying is pointless and the
  // user has to go through the full authorize flow again.
  if (isInvalidGrant(result) || status === 400 || status === 401 || status === 403) {
    await clearAuthCookies();
  }

  return {status, data};
}

async function refreshLegacySession(refreshToken: string): Promise<RefreshResult> {
  const authClientPayload = getAuthClientPayload('refresh_token');
  if (!authClientPayload) {
    return {status: 500, data: {message: MISSING_AUTH_CLIENT_MESSAGE}};
  }

  const {status, data} = await callWorfApi('/v1/auth/token', {
    method: 'POST',
    body: {
      ...authClientPayload,
      refresh_token: refreshToken,
      scopes: parseScopes()
    }
  });

  if (status >= 200 && status < 300) {
    const tokens = data as {
      access_token?: string;
      refresh_token?: string;
      multi_factor_token?: string;
    };

    await setAuthCookies({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      multi_factor_token: tokens.multi_factor_token
    });
  } else if (status === 401 || status === 403) {
    await clearAuthCookies();
  }

  return {status, data};
}

async function refreshAccessToken(): Promise<RefreshResult> {
  const refreshToken = await getServerRefreshToken();
  if (!refreshToken) {
    await clearAuthCookies();
    return {status: 401, data: {message: 'Missing refresh token'}};
  }

  const authOrigin = await getServerAuthOrigin();
  return authOrigin === OAUTH_AUTH_ORIGIN
    ? refreshOAuthSession(refreshToken)
    : refreshLegacySession(refreshToken);
}
```

A fájl többi része (`sanitizeRedirectPath`, `POST`, `GET`) változatlan marad.

- [x] **2. lépés: Típusellenőrzés és lint**

Futtatás: `npx tsc --noEmit` és `npm run lint`
Várt: nincs új hiba ehhez a fájlhoz.

- [x] **3. lépés: Commit**

```bash
git add app/api/auth/token/route.ts
git commit -m "feat: refresh OAuth sessions against /oauth/token with rotation handling"
```

---

## Task 10: Proxy — Bearer header és `insufficient_scope`

**Fájlok:**
- Létrehoz: `lib/server/www-authenticate.ts`
- Teszt: `lib/server/__tests__/www-authenticate.test.ts`
- Módosít: `app/api/proxy/[...path]/route.ts`
- Módosít: `lib/api/client.ts`

**Interfészek:**
- Előállít: `parseWwwAuthenticate(header: string | null | undefined): {scheme?: string; error?: string; scope?: string}`.
- A proxy 403 + `insufficient_scope` esetén a válasz JSON-jébe `{"error": "insufficient_scope", "required_scope": "..."}` mezőket tesz, és minden válaszban továbbadja a `WWW-Authenticate` headert.
- A `lib/api/client.ts` interceptora az axios error objektumra teszi a `requiredScope` mezőt, amikor a válasz `insufficient_scope`.

- [x] **1. lépés: Írd meg a bukó tesztet**

```typescript
// lib/server/__tests__/www-authenticate.test.ts
import {describe, expect, it} from 'vitest';
import {parseWwwAuthenticate} from '../www-authenticate';

describe('parseWwwAuthenticate', () => {
  it('returns an empty result for a missing header', () => {
    expect(parseWwwAuthenticate(null)).toEqual({});
    expect(parseWwwAuthenticate(undefined)).toEqual({});
    expect(parseWwwAuthenticate('')).toEqual({});
  });

  it('parses an insufficient_scope challenge', () => {
    const parsed = parseWwwAuthenticate('Bearer error="insufficient_scope", scope="group.post.read"');
    expect(parsed.scheme).toBe('Bearer');
    expect(parsed.error).toBe('insufficient_scope');
    expect(parsed.scope).toBe('group.post.read');
  });

  it('parses a resource_metadata challenge without an error parameter', () => {
    const parsed = parseWwwAuthenticate(
      'Bearer resource_metadata="https://worf.vaultdrive.eu/.well-known/oauth-protected-resource", scope="post.get.global task.read"'
    );
    expect(parsed.error).toBeUndefined();
    expect(parsed.scope).toBe('post.get.global task.read');
  });

  it('tolerates unquoted parameter values', () => {
    expect(parseWwwAuthenticate('Bearer error=insufficient_scope, scope=group.create').error).toBe(
      'insufficient_scope'
    );
  });
});
```

- [x] **2. lépés: Futtasd, ellenőrizd, hogy bukik**

Futtatás: `npx vitest run lib/server/__tests__/www-authenticate.test.ts`
Várt: FAIL — `Cannot find module '../www-authenticate'`.

- [x] **3. lépés: Írd meg a `lib/server/www-authenticate.ts`-t**

```typescript
export type WwwAuthenticateChallenge = {
  scheme?: string;
  error?: string;
  scope?: string;
};

const PARAM_PATTERN = /([a-zA-Z_-]+)\s*=\s*(?:"([^"]*)"|([^,\s]+))/g;

export function parseWwwAuthenticate(header: string | null | undefined): WwwAuthenticateChallenge {
  if (!header) {
    return {};
  }

  const challenge: WwwAuthenticateChallenge = {};
  const [scheme] = header.trim().split(/\s+/, 1);
  if (scheme && !scheme.includes('=')) {
    challenge.scheme = scheme;
  }

  for (const match of header.matchAll(PARAM_PATTERN)) {
    const key = match[1].toLowerCase();
    const value = match[2] ?? match[3];
    if (key === 'error') {
      challenge.error = value;
    } else if (key === 'scope') {
      challenge.scope = value;
    }
  }

  return challenge;
}
```

- [x] **4. lépés: Futtasd, ellenőrizd, hogy átmegy**

Futtatás: `npx vitest run lib/server/__tests__/www-authenticate.test.ts`
Várt: PASS (4 teszt).

- [x] **5. lépés: Add a Bearer headert és a header-továbbítást a proxyhoz**

Az `app/api/proxy/[...path]/route.ts`-ben négy pontosan meghatározott változtatás kell.

**(a)** Egészítsd ki a `RawHttpResponse` típust és a `sendJsonWithBody` `resolve`-ját a `WWW-Authenticate` headerrel:

```typescript
type RawHttpResponse = {
  status: number;
  text: string;
  contentType: string;
  wwwAuthenticate?: string;
};
```

A `res.on('end', ...)` blokkban:

```typescript
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 500,
            text: Buffer.concat(chunks).toString('utf8'),
            contentType: (res.headers['content-type'] as string | undefined) ?? 'application/json',
            wwwAuthenticate: res.headers['www-authenticate'] as string | undefined
          });
        });
```

**(b)** Vedd fel az importot a fájl tetején:

```typescript
import {parseWwwAuthenticate} from '@/lib/server/www-authenticate';
```

**(c)** A `handleProxy`-ban a token mindkét helyre kerüljön. Cseréld a meglévő `payload` összeállítást és a `sendJsonWithBody` hívást erre (a `forwardedFor` számítás változatlan marad felette):

```typescript
  const payload: Record<string, any> = {
    ...parsedBody,
    // The native REST endpoints read the token from the JSON body; the OAuth
    // resource server advertises bearer_methods_supported: ["header"]. Sending
    // both keeps every endpoint working with either kind of token.
    ...(token && !isFilesTrash ? {Bearer: token} : {})
  };
```

majd lentebb:

```typescript
  const response = await sendJsonWithBody(targetUrl, upstreamMethod, payload, {
    ...(forwardedFor ? {'x-forwarded-for': forwardedFor} : {}),
    ...(token ? {Authorization: `Bearer ${token}`} : {})
  });
```

(A korábbi `isFilesTrash && token` feltételes `Authorization` header helyére most a feltétel nélküli változat kerül — a `files/trash` így is megkapja, amit eddig.)

**(d)** A visszatérési ág kezelje a `WWW-Authenticate`-et és a `insufficient_scope`-ot. Cseréld a záró `return new NextResponse(...)`-t erre:

```typescript
  const challenge = parseWwwAuthenticate(response.wwwAuthenticate);
  let responseText = normalizedResponse.text;
  let responseContentType = normalizedResponse.contentType;

  if (response.status === 403 && challenge.error === 'insufficient_scope') {
    const base =
      responseContentType.toLowerCase().includes('json') && responseText.trim()
        ? ((() => {
            try {
              return JSON.parse(responseText) as Record<string, unknown>;
            } catch {
              return {};
            }
          })() as Record<string, unknown>)
        : {};

    responseText = JSON.stringify({
      ...base,
      error: 'insufficient_scope',
      ...(challenge.scope ? {required_scope: challenge.scope} : {})
    });
    responseContentType = 'application/json';
  }

  return new NextResponse(responseText, {
    status: response.status,
    headers: {
      'Content-Type': responseContentType,
      ...(response.wwwAuthenticate ? {'WWW-Authenticate': response.wwwAuthenticate} : {})
    }
  });
```

- [x] **6. lépés: Jelöld meg a hibát a kliensoldali interceptorban**

A `lib/api/client.ts` response interceptorában, a `return Promise.reject(error)` záró sor **elé** szúrd be:

```typescript
    if (error.response?.status === 403) {
      const payload = error.response.data as {error?: string; required_scope?: string} | undefined;
      if (payload?.error === 'insufficient_scope') {
        error.isInsufficientScope = true;
        error.requiredScope = payload.required_scope;
      }
    }
```

Ez szándékosan nem dob toastot: a fájl meglévő elve szerint az interceptor csak elutasított promise-t ad vissza, a megjelenítés a hívó komponensé.

- [x] **7. lépés: Típusellenőrzés, lint és teljes tesztfuttatás**

Futtatás: `npx tsc --noEmit`, `npm run lint`, `npm run test`
Várt: nincs hiba, minden teszt zöld.

- [x] **8. lépés: Commit**

```bash
git add lib/server/www-authenticate.ts lib/server/__tests__/www-authenticate.test.ts app/api/proxy/[...path]/route.ts lib/api/client.ts
git commit -m "feat: send bearer header and surface insufficient_scope through the proxy"
```

---

## Task 11: Login oldal — a hibaüzenetek megjelenítése

**Fájlok:**
- Módosít: `app/[locale]/auth/login/page.tsx`
- Létrehoz: `components/auth/LoginError.tsx`
- Módosít: `messages/hu.json`, `messages/en.json` (`auth` blokk)

**Interfészek:**
- Fogyaszt: a Task 7/8 route-jai által beállított `?error=<kód vagy szöveg>` query paramétert.
- Előállít: `LoginError` komponens, amely az ismert OAuth hibakódokat lefordítja, ismeretlen érték esetén a nyers szöveget mutatja.

Enélkül a Task 7/8 minden hibaága némán a login oldalra dob vissza, magyarázat nélkül — ma a `page.tsx` nem olvassa a `searchParams`-ot.

- [x] **1. lépés: Vedd fel az i18n kulcsokat a `messages/hu.json` `auth` blokkjába**

```json
    "error_title": "A bejelentkezés nem sikerült",
    "error_access_denied": "A hozzáférést elutasítottad a jóváhagyó képernyőn.",
    "error_invalid_issuer": "A válasz nem a várt kiszolgálótól érkezett. Biztonsági okból megszakítottuk a bejelentkezést.",
    "error_invalid_state": "A bejelentkezési kérés nem azonosítható. Próbáld újra.",
    "error_expired_request": "A bejelentkezési kérés lejárt. Próbáld újra.",
    "error_invalid_request": "Hiányos válasz érkezett a bejelentkezési kiszolgálótól.",
    "error_token_exchange_failed": "A bejelentkezés nem fejezhető be. Próbáld újra.",
    "error_temporarily_unavailable": "A bejelentkezési szolgáltatás átmenetileg nem érhető el. Próbáld újra később.",
    "error_server_error": "A bejelentkezés szerverhiba miatt megszakadt."
```

- [x] **2. lépés: Vedd fel ugyanezeket a `messages/en.json` `auth` blokkjába**

```json
    "error_title": "Sign-in failed",
    "error_access_denied": "You declined access on the consent screen.",
    "error_invalid_issuer": "The response did not come from the expected server. Sign-in was aborted for security reasons.",
    "error_invalid_state": "The sign-in request could not be identified. Please try again.",
    "error_expired_request": "The sign-in request expired. Please try again.",
    "error_invalid_request": "The sign-in server returned an incomplete response.",
    "error_token_exchange_failed": "Sign-in could not be completed. Please try again.",
    "error_temporarily_unavailable": "The sign-in service is temporarily unavailable. Please try again later.",
    "error_server_error": "Sign-in was interrupted by a server error."
```

- [x] **3. lépés: Írd meg a `components/auth/LoginError.tsx`-t**

```typescript
import {AlertTriangle} from 'lucide-react';
import {getTranslations} from 'next-intl/server';

const KNOWN_ERRORS = [
  'access_denied',
  'invalid_issuer',
  'invalid_state',
  'expired_request',
  'invalid_request',
  'token_exchange_failed',
  'temporarily_unavailable',
  'server_error'
] as const;

type KnownError = (typeof KNOWN_ERRORS)[number];

const isKnownError = (value: string): value is KnownError =>
  (KNOWN_ERRORS as readonly string[]).includes(value);

export default async function LoginError({error}: {error: string}) {
  const t = await getTranslations('auth');
  const message = isKnownError(error) ? t(`error_${error}`) : error;

  return (
    <div className="auth-error" role="alert">
      <AlertTriangle size={16} strokeWidth={1.75} />
      <div>
        <strong>{t('error_title')}</strong>
        <p>{message}</p>
      </div>
    </div>
  );
}
```

- [x] **4. lépés: Kösd be a `app/[locale]/auth/login/page.tsx`-be**

A komponens szignatúrája bővül a `searchParams`-szal, és a `<div className="auth-divider" />` elé kerül a hibablokk:

```typescript
export default async function LoginPage({
  params,
  searchParams
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{error?: string | string[]}>;
}) {
  const {locale} = await params;
  const {error} = await searchParams;
  const errorMessage = Array.isArray(error) ? error[0] : error;
  const t = await getTranslations('auth');
```

majd a JSX-ben, közvetlenül a `<div className="auth-divider" />` sor előtt:

```tsx
        {errorMessage ? <LoginError error={errorMessage} /> : null}
```

És az importok közé:

```typescript
import LoginError from '@/components/auth/LoginError';
```

- [x] **5. lépés: Adj stílust az `app/globals.css`-hez**

Keresd meg az `.auth-info` szabályt, és utána szúrd be:

```css
.auth-error {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  margin: 0 0 1rem;
  padding: 0.75rem;
  border: 1px solid var(--danger-border, rgba(220, 38, 38, 0.35));
  border-radius: 0.5rem;
  background: var(--danger-surface, rgba(220, 38, 38, 0.08));
  color: var(--danger-text, #b91c1c);
  font-size: 0.85rem;
  text-align: left;
}

.auth-error p {
  margin: 0.125rem 0 0;
}
```

- [x] **6. lépés: Típusellenőrzés és lint**

Futtatás: `npx tsc --noEmit` és `npm run lint`
Várt: nincs hiba.

- [x] **7. lépés: Kézi ellenőrzés**

`npm run dev` mellett nyisd meg: `http://localhost:3000/hu/auth/login?error=invalid_issuer`
Várt: a bejelentkezés gomb fölött megjelenik a piros hibadoboz a magyar szöveggel. Ugyanez `?error=valami-ismeretlen` esetén a nyers szöveget mutatja.

- [x] **8. lépés: Commit**

```bash
git add app/[locale]/auth/login/page.tsx components/auth/LoginError.tsx messages/hu.json messages/en.json app/globals.css
git commit -m "feat: show OAuth sign-in errors on the login page"
```

---

## Task 12: A holt legacy auth route-ok törlése

**Fájlok:**
- Töröl: `app/api/auth/login/`, `app/api/auth/mfa/`, `app/api/auth/register/`, `app/api/auth/forget-password/`, `app/api/auth/reset-password/`, `app/api/auth/verify-email/`, `app/api/auth/send-verification/`
- Módosít: `lib/api/auth.ts`

**Interfészek:**
- A `lib/api/auth.ts`-ből csak a `logout` marad (egyetlen hívója: `components/layout/Header.tsx:42`).
- `lib/server/auth-client.ts` **változatlan**: a `getAuthClientPayload` mindkét grant típusa használatban marad (a logout `password`-öt, a Task 9 legacy ága `refresh_token`-t kér).

- [x] **1. lépés: Igazold, hogy tényleg nincs hívójuk**

Futtatás:

```bash
grep -rnE "verifyMfa|forgetPassword|resetPassword|verifyEmail|sendEmailVerification|api/auth/(login|mfa|register|forget-password|reset-password|verify-email|send-verification)" --include="*.ts" --include="*.tsx" app components lib hooks | grep -v "^app/api/auth/" | grep -v "^lib/api/auth.ts"
```

Várt: nincs találat. **Ha van, állj meg**, és jelezd — az adott route mégis használatban van, nem törölhető.

- [x] **2. lépés: Töröld a route-okat**

```bash
rm -r "app/api/auth/login" "app/api/auth/mfa" "app/api/auth/register" "app/api/auth/forget-password" "app/api/auth/reset-password" "app/api/auth/verify-email" "app/api/auth/send-verification"
```

- [x] **3. lépés: Írd újra a `lib/api/auth.ts`-t**

```typescript
import axios from 'axios';

export const logout = () => axios.post('/api/auth/logout', {}, {withCredentials: true});
```

- [x] **4. lépés: Ellenőrizd, mi maradt**

Futtatás: `ls app/api/auth`
Várt: pontosan `logout`, `oauth`, `token`.

- [x] **5. lépés: Típusellenőrzés, lint és build**

Futtatás: `npx tsc --noEmit`, `npm run lint`, `npm run build`
Várt: nincs hiba; a build lefut (ez fogja meg, ha valamelyik törölt route-ra mégis hivatkozik egy oldal).

- [x] **6. lépés: Commit**

```bash
git add -A app/api/auth lib/api/auth.ts
git commit -m "chore: remove unused legacy auth routes and API helpers"
```

---

## Task 13: Teljes ellenőrzés

- [x] **1. lépés: Teljes tesztfuttatás**

Futtatás: `npm run test`
Várt: minden teszt zöld, beleértve az új suite-okat (`pkce`, `oauth-discovery`, `oauth-client-assertion`, `oauth-token`, `constants`, `www-authenticate`).

- [x] **2. lépés: Típusellenőrzés és build**

Futtatás: `npx tsc --noEmit` és `npm run build`
Várt: nincs hiba.

- [x] **3. lépés: Statikus megfelelőségi ellenőrzések**

```bash
grep -rn "client_secret" app/api/auth/oauth/ ; echo "--- (üres kell legyen)"
grep -rn "resource=" app/api/auth/ lib/server/oauth-token.ts ; echo "--- (üres kell legyen)"
grep -rn "offline_access" lib/server/oauth-discovery.ts ; echo "--- (kell találat)"
grep -rn "v1/oauth/login" app lib ; echo "--- (üres kell legyen)"
```

- [ ] **4. lépés: Kliens-regisztráció (a felhasználó kifejezett engedélyével)**

Futtatás: `npm run register-oauth-client -- --redirect-uri http://localhost:3000/api/auth/oauth/callback`
Várt: `Registration succeeded. client_id: ...`. Másold a kiírt három értéket a `.env`-be (`WORF_OAUTH_CLIENT_ID`, `WORF_OAUTH_KID`, `WORF_OAUTH_PRIVATE_KEY`).

- [ ] **5. lépés: Éles bejelentkezési kör**

`npm run dev` mellett a `http://localhost:3000/hu/auth/login` oldalról indítva:

1. A gomb a backend login oldalára visz; a címsorban **nincs** `client_secret`, viszont van `code_challenge`, `code_challenge_method=S256`, `state` és `scope` (benne `offline_access`).
2. Bejelentkezés után (MFA, ha aktív; consent) a visszairányítás `code`, `state` és `iss` paraméterekkel érkezik.
3. A böngésző a `/hu/dashboard`-on landol; a devtools Application → Cookies fülön ott van `worf_access_token`, `worf_refresh_token`, `worf_auth_origin=oauth`, és **eltűnt** a `worf_pkce_verifier`/`worf_pkce_state`.
4. A dashboard adatai betöltenek (a scope elég az API-hívásokhoz).
5. Az access cookie kézi törlése után egy API-hívás néma refresh után sikerül, és a `worf_refresh_token` értéke megváltozik (rotáció).
6. Kijelentkezés után minden `worf_*` auth cookie eltűnik.

- [ ] **6. lépés: Zárócommit, ha maradt módosítás**

```bash
git status --short
```

---

## Önellenőrzés (a terv írásakor elvégezve)

**Spec-lefedettség:**

| Spec-követelmény | Task |
|---|---|
| PKCE S256 | 1, 7 |
| Discovery-alapú endpointok és scope | 2, 7 |
| `offline_access` | 2 (`PSEUDO_SCOPES`) |
| `private_key_jwt` assertion | 3 |
| Form-urlencoded `/oauth/token`, `resource` nélkül | 4 |
| `invalid_grant` felismerés | 4, 9 |
| PKCE/state/auth-origin cookie-k | 5 |
| `expires_in`-alapú access cookie | 5, 8 |
| Kliens-regisztráció, env | 6 |
| `client_secret` eltávolítása az URL-ből | 7 |
| `iss` validáció (RFC 9207) | 8 |
| `state` CSRF-ellenőrzés | 8 |
| Hiányzó `refresh_token` naplózása | 8 |
| Refresh útválasztás session-eredet szerint | 9 |
| Refresh-rotáció, retry tiltása | 9 |
| Bearer header + body | 10 |
| 403 `insufficient_scope` | 10 |
| OAuth hibaformátum megjelenítése | 11 |
| Holt legacy route-ok törlése | 12 |
| Kézi végpontok közötti ellenőrzés | 13 |

**Típus-konzisztencia:** a `buildClientAssertion(audience)` szignatúráját a Task 3 vezeti be és a Task 4 hívja; a `setAuthCookies` `expires_in` mezőjét a Task 5 vezeti be, a Task 8 és 9 használja; a `getServerAuthOrigin()`-t a Task 5 hozza létre, a Task 9 fogyasztja; az `isInvalidGrant()`-ot a Task 4 exportálja, a Task 9 hívja.
