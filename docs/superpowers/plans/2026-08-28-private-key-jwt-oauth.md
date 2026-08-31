# private_key_jwt OAuth-redirect flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the worf-app OAuth-redirect ("Bejelentkezés" button) login flow from the legacy `/v1/oauth/login` + `/v1/auth/token` endpoints to the RFC-compliant `/oauth/authorize` (PKCE) + `/oauth/token` endpoints, authenticating the client with `private_key_jwt` (RFC 7523) instead of a static secret.

**Architecture:** Server-only Next.js route handlers gain a PKCE helper, a `jose`-based client-assertion signer, and a form-urlencoded `/oauth/token` client. The login route redirects the browser to the backend-hosted `/oauth/authorize` page (unchanged pattern, new endpoint + PKCE params). The callback route exchanges the returned `code` for tokens via `/oauth/token` with a signed client assertion, and marks the resulting session with an `worf_auth_origin=oauth` cookie so the refresh route knows to keep renewing it against `/oauth/token` (not the legacy `/v1/auth/token`, which would silently drop scope/client-binding). The legacy password login (`/v1/auth/login`, MFA) is untouched.

**Tech Stack:** Next.js 15 App Router route handlers, TypeScript, `jose` (new dependency) for JWT signing/verification, Node's built-in `crypto`/`fetch`, Vitest for unit tests.

**Spec:** `docs/superpowers/specs/2026-08-28-private-key-jwt-oauth-design.md`

## Global Constraints

- Signing algorithm: ES256 (EC P-256) only — this plan does not implement the RS256/RSA path.
- `client_assertion` lifetime: `exp - iat` must never exceed 300 seconds (spec uses 60s).
- `client_assertion` `aud` claim must be exactly `${WORF_API_URL}/oauth/token` (no trailing slash duplication).
- Every `client_assertion` carries a fresh, unique `jti` (RFC 7523 replay protection) — never reuse or cache a signed assertion.
- The private key (`WORF_OAUTH_PRIVATE_KEY`) is read only from server-side env vars, only inside `lib/server/*` files, and must never be sent to the browser or logged in full.
- The legacy password login flow (`app/api/auth/login/route.ts`, `app/api/auth/mfa/route.ts`, `/v1/auth/login`, `/v1/auth/multi-factor-authentication`) is out of scope — do not modify it, do not change `getAuthClientPayload`/`WORF_CLIENT_SECRET` usage there.
- `/oauth/token` requests use `application/x-www-form-urlencoded` bodies (not JSON) — do not reuse `callWorfApi` (`lib/server/worf.ts`), which always sends JSON.
- A session's refresh must go to the same system that issued it: sessions from the OAuth-redirect flow (`worf_auth_origin=oauth` cookie) refresh via `/oauth/token`; all other sessions keep using the existing `/v1/auth/token` + `client_id`/`client_secret` path unchanged.

---

## Task 1: Add the `jose` dependency

**Files:**
- Modify: `package.json`, `package-lock.json`

**Interfaces:**
- Produces: the `jose` package (`SignJWT`, `importPKCS8`, `importSPKI`, `jwtVerify`) available to later tasks.

- [ ] **Step 1: Install the package**

Run: `npm install jose`

- [ ] **Step 2: Verify it resolves**

Run: `node -e "require('jose'); console.log('jose ok')"` from the `worf-app` directory (Node can load the package's CJS/ESM entry either way through `node -e` since it's just a resolution check — if this errors, run `node --input-type=module -e "import('jose').then(()=>console.log('jose ok'))"` instead).
Expected: prints `jose ok`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add jose for OAuth client-assertion signing"
```

---

## Task 2: PKCE helper

**Files:**
- Create: `lib/server/pkce.ts`
- Test: `lib/server/__tests__/pkce.test.ts`

**Interfaces:**
- Produces: `generateCodeVerifier(): string`, `generateCodeChallenge(codeVerifier: string): string`, `generatePkcePair(): {codeVerifier: string; codeChallenge: string}`, `generateState(): string`.

- [ ] **Step 1: Write the failing tests**

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

  it('generates a non-empty base64url state value', () => {
    const state = generateState();
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(state.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/server/__tests__/pkce.test.ts`
Expected: FAIL — `Cannot find module '../pkce'`.

- [ ] **Step 3: Implement `lib/server/pkce.ts`**

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

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/server/__tests__/pkce.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/server/pkce.ts lib/server/__tests__/pkce.test.ts
git commit -m "feat: add PKCE code verifier/challenge helper"
```

---

## Task 3: OAuth client-assertion signer

**Files:**
- Create: `lib/server/oauth-client-assertion.ts`
- Test: `lib/server/__tests__/oauth-client-assertion.test.ts`

**Interfaces:**
- Consumes: none from earlier tasks (reads `process.env` directly: `WORF_API_URL`, `WORF_OAUTH_CLIENT_ID`, `WORF_OAUTH_PRIVATE_KEY`, `WORF_OAUTH_KID`). Note: this is a **different** env var from `WORF_CLIENT_ID`, which stays reserved for the legacy password-login client (`lib/server/auth-client.ts`) — the OAuth-redirect flow registers its own client with its own id.
- Produces: `buildClientAssertion(): Promise<string | null>` (returns `null` when any required env var is missing), `CLIENT_ASSERTION_TYPE: string` (the constant `'urn:ietf:params:oauth:client-assertion-type:jwt-bearer'`).

- [ ] **Step 1: Write the failing tests**

```typescript
// lib/server/__tests__/oauth-client-assertion.test.ts
import {generateKeyPairSync} from 'node:crypto';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {importSPKI, jwtVerify} from 'jose';
import {buildClientAssertion, CLIENT_ASSERTION_TYPE} from '../oauth-client-assertion';

describe('buildClientAssertion', () => {
  const originalEnv = {...process.env};
  let publicKeyPem: string;

  beforeEach(() => {
    const {privateKey, publicKey} = generateKeyPairSync('ec', {namedCurve: 'prime256v1'});
    publicKeyPem = publicKey.export({type: 'spki', format: 'pem'}).toString();

    process.env.WORF_API_URL = 'https://worf.vaultdrive.eu';
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

  it('signs a JWT with the required claims, a TTL under 300s, and aud=token endpoint', async () => {
    const assertion = await buildClientAssertion();
    expect(assertion).not.toBeNull();

    const publicKey = await importSPKI(publicKeyPem, 'ES256');
    const {payload, protectedHeader} = await jwtVerify(assertion as string, publicKey, {
      audience: 'https://worf.vaultdrive.eu/oauth/token'
    });

    expect(protectedHeader.kid).toBe('test-kid');
    expect(protectedHeader.alg).toBe('ES256');
    expect(payload.iss).toBe('test-client-id');
    expect(payload.sub).toBe('test-client-id');
    expect(typeof payload.jti).toBe('string');
    expect((payload.jti as string).length).toBeGreaterThan(0);
    expect((payload.exp as number) - (payload.iat as number)).toBeLessThanOrEqual(300);
  });

  it('produces a different jti on every call', async () => {
    const first = (await buildClientAssertion()) as string;
    const second = (await buildClientAssertion()) as string;
    const decode = (token: string) => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    expect(decode(first).jti).not.toBe(decode(second).jti);
  });

  it('returns null when a required env var is missing', async () => {
    delete process.env.WORF_OAUTH_KID;
    const assertion = await buildClientAssertion();
    expect(assertion).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/server/__tests__/oauth-client-assertion.test.ts`
Expected: FAIL — `Cannot find module '../oauth-client-assertion'`.

- [ ] **Step 3: Implement `lib/server/oauth-client-assertion.ts`**

```typescript
import {randomUUID} from 'node:crypto';
import {importPKCS8, SignJWT} from 'jose';

export const CLIENT_ASSERTION_TYPE = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer';

const CLIENT_ASSERTION_TTL_SECONDS = 60;

export async function buildClientAssertion(): Promise<string | null> {
  const clientId = process.env.WORF_OAUTH_CLIENT_ID;
  const privateKeyPem = process.env.WORF_OAUTH_PRIVATE_KEY;
  const kid = process.env.WORF_OAUTH_KID;
  const apiBase = process.env.WORF_API_URL;

  if (!clientId || !privateKeyPem || !kid || !apiBase) {
    return null;
  }

  const privateKey = await importPKCS8(privateKeyPem.replace(/\\n/g, '\n'), 'ES256');
  const tokenEndpoint = new URL('/oauth/token', apiBase.endsWith('/') ? apiBase : `${apiBase}/`).toString();
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({iss: clientId, sub: clientId})
    .setProtectedHeader({alg: 'ES256', kid, typ: 'JWT'})
    .setIssuedAt(now)
    .setExpirationTime(now + CLIENT_ASSERTION_TTL_SECONDS)
    .setAudience(tokenEndpoint)
    .setJti(randomUUID())
    .sign(privateKey);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/server/__tests__/oauth-client-assertion.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/server/oauth-client-assertion.ts lib/server/__tests__/oauth-client-assertion.test.ts
git commit -m "feat: sign private_key_jwt client assertions with jose"
```

---

## Task 4: Form-urlencoded `/oauth/token` client

**Files:**
- Create: `lib/server/oauth-token.ts`
- Test: `lib/server/__tests__/oauth-token.test.ts`

**Interfaces:**
- Consumes: `buildClientAssertion()`, `CLIENT_ASSERTION_TYPE` from `lib/server/oauth-client-assertion.ts` (Task 3).
- Produces: `exchangeAuthorizationCode(params: {code: string; redirectUri: string; codeVerifier: string}): Promise<OAuthTokenResult>`, `refreshWithOAuthToken(refreshToken: string): Promise<OAuthTokenResult>`, and the type `OAuthTokenResult = {status: number; data: {access_token?: string; refresh_token?: string; error?: string; error_description?: string; [key: string]: unknown}}`.

- [ ] **Step 1: Write the failing tests**

```typescript
// lib/server/__tests__/oauth-token.test.ts
import {generateKeyPairSync} from 'node:crypto';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {exchangeAuthorizationCode, refreshWithOAuthToken} from '../oauth-token';

describe('oauth-token', () => {
  const originalEnv = {...process.env};
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env = {...originalEnv, WORF_API_URL: 'https://worf.vaultdrive.eu'};
    delete process.env.WORF_OAUTH_CLIENT_ID;
    delete process.env.WORF_OAUTH_KID;
    delete process.env.WORF_OAUTH_PRIVATE_KEY;
  });

  afterEach(() => {
    process.env = {...originalEnv};
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns a server_error without calling fetch when the client assertion cannot be built', async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await exchangeAuthorizationCode({
      code: 'abc',
      redirectUri: 'https://app.example/callback',
      codeVerifier: 'verifier'
    });

    expect(result.status).toBe(500);
    expect(result.data.error).toBe('server_error');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts a form-urlencoded refresh_token grant with the signed client assertion', async () => {
    const {privateKey} = generateKeyPairSync('ec', {namedCurve: 'prime256v1'});
    process.env.WORF_OAUTH_CLIENT_ID = 'client-123';
    process.env.WORF_OAUTH_KID = 'kid-1';
    process.env.WORF_OAUTH_PRIVATE_KEY = privateKey.export({type: 'pkcs8', format: 'pem'}).toString();

    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({access_token: 'at', refresh_token: 'rt'})
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await refreshWithOAuthToken('old-refresh-token');

    expect(result.status).toBe(200);
    expect(result.data.access_token).toBe('at');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url.toString()).toBe('https://worf.vaultdrive.eu/oauth/token');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/x-www-form-urlencoded');

    const body = new URLSearchParams(init.body as string);
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe('old-refresh-token');
    expect(body.get('client_assertion_type')).toBe('urn:ietf:params:oauth:client-assertion-type:jwt-bearer');
    expect(body.get('client_assertion')).toBeTruthy();
    expect(body.has('code')).toBe(false);
  });

  it('posts a form-urlencoded authorization_code grant', async () => {
    const {privateKey} = generateKeyPairSync('ec', {namedCurve: 'prime256v1'});
    process.env.WORF_OAUTH_CLIENT_ID = 'client-123';
    process.env.WORF_OAUTH_KID = 'kid-1';
    process.env.WORF_OAUTH_PRIVATE_KEY = privateKey.export({type: 'pkcs8', format: 'pem'}).toString();

    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({access_token: 'at', refresh_token: 'rt'})
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await exchangeAuthorizationCode({
      code: 'auth-code',
      redirectUri: 'https://app.example/callback',
      codeVerifier: 'verifier-value'
    });

    const [, init] = fetchMock.mock.calls[0];
    const body = new URLSearchParams(init.body as string);
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('auth-code');
    expect(body.get('redirect_uri')).toBe('https://app.example/callback');
    expect(body.get('code_verifier')).toBe('verifier-value');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/server/__tests__/oauth-token.test.ts`
Expected: FAIL — `Cannot find module '../oauth-token'`.

- [ ] **Step 3: Implement `lib/server/oauth-token.ts`**

```typescript
import {buildClientAssertion, CLIENT_ASSERTION_TYPE} from './oauth-client-assertion';

export type OAuthTokenResult = {
  status: number;
  data: {
    access_token?: string;
    refresh_token?: string;
    error?: string;
    error_description?: string;
    [key: string]: unknown;
  };
};

async function postOAuthToken(params: Record<string, string>): Promise<OAuthTokenResult> {
  const apiBase = process.env.WORF_API_URL;
  if (!apiBase) {
    throw new Error('WORF_API_URL is not configured');
  }

  const assertion = await buildClientAssertion();
  if (!assertion) {
    return {
      status: 500,
      data: {error: 'server_error', error_description: 'OAuth client assertion is not configured'}
    };
  }

  const body = new URLSearchParams({
    ...params,
    client_assertion_type: CLIENT_ASSERTION_TYPE,
    client_assertion: assertion
  });

  const tokenUrl = new URL('/oauth/token', apiBase.endsWith('/') ? apiBase : `${apiBase}/`);
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: body.toString()
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

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/server/__tests__/oauth-token.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/server/oauth-token.ts lib/server/__tests__/oauth-token.test.ts
git commit -m "feat: add form-urlencoded /oauth/token client"
```

---

## Task 5: PKCE/state/session-origin cookie constants

**Files:**
- Modify: `lib/utils/constants.ts`
- Test: `lib/utils/__tests__/constants.test.ts`

**Interfaces:**
- Produces: `PKCE_VERIFIER_COOKIE = 'worf_pkce_verifier'`, `PKCE_STATE_COOKIE = 'worf_pkce_state'`, `AUTH_ORIGIN_COOKIE = 'worf_auth_origin'`, `OAUTH_AUTH_ORIGIN = 'oauth'`, `PKCE_COOKIE_OPTIONS` (spreads existing `AUTH_COOKIE_OPTIONS` with `maxAge: 60 * 10`), `AUTH_ORIGIN_COOKIE_OPTIONS` (spreads `AUTH_COOKIE_OPTIONS` with `maxAge: 60 * 60 * 24 * 30`, matching the refresh cookie's lifetime).

- [ ] **Step 1: Write the failing test**

```typescript
// lib/utils/__tests__/constants.test.ts
import {describe, expect, it} from 'vitest';
import {
  AUTH_ORIGIN_COOKIE,
  AUTH_ORIGIN_COOKIE_OPTIONS,
  OAUTH_AUTH_ORIGIN,
  PKCE_COOKIE_OPTIONS,
  PKCE_STATE_COOKIE,
  PKCE_VERIFIER_COOKIE
} from '../constants';

describe('OAuth cookie constants', () => {
  it('defines distinct cookie names for PKCE verifier, PKCE state, and auth origin', () => {
    const names = [PKCE_VERIFIER_COOKIE, PKCE_STATE_COOKIE, AUTH_ORIGIN_COOKIE];
    expect(new Set(names).size).toBe(names.length);
    expect(PKCE_VERIFIER_COOKIE).toBe('worf_pkce_verifier');
    expect(PKCE_STATE_COOKIE).toBe('worf_pkce_state');
    expect(AUTH_ORIGIN_COOKIE).toBe('worf_auth_origin');
  });

  it('marks the OAuth session origin value', () => {
    expect(OAUTH_AUTH_ORIGIN).toBe('oauth');
  });

  it('sets a short lifetime for PKCE cookies and httpOnly on both option sets', () => {
    expect(PKCE_COOKIE_OPTIONS.maxAge).toBe(600);
    expect(PKCE_COOKIE_OPTIONS.httpOnly).toBe(true);
    expect(AUTH_ORIGIN_COOKIE_OPTIONS.maxAge).toBe(60 * 60 * 24 * 30);
    expect(AUTH_ORIGIN_COOKIE_OPTIONS.httpOnly).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/utils/__tests__/constants.test.ts`
Expected: FAIL — the new named exports don't exist yet.

- [ ] **Step 3: Add the constants to `lib/utils/constants.ts`**

Append to the end of the existing file (keep the current four exports unchanged):

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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/utils/__tests__/constants.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/utils/constants.ts lib/utils/__tests__/constants.test.ts
git commit -m "feat: add PKCE and auth-origin cookie constants"
```

---

## Task 6: `register-oauth-client.mjs` setup script

**Files:**
- Create: `scripts/register-oauth-client.mjs`
- Modify: `package.json` (add a `register-oauth-client` script entry)

**Interfaces:**
- Consumes: none (standalone Node script, run manually — not imported by app code).
- Produces: a CLI that prints a generated ES256 keypair (public JWK + PEM private key + kid) and, unless `--dry-run` is passed, registers a new `private_key_jwt` client via `POST {WORF_API_URL}/oauth/register`.

- [ ] **Step 1: Write the script**

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

  return {
    publicJwk: {...publicJwk, kid, use: 'sig', alg: 'ES256'},
    privateKeyPem,
    kid
  };
}

function parseArgs(argv) {
  const args = {dryRun: false, clientName: 'Worf Frontend (private_key_jwt)', redirectUris: [], scope: ''};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--redirect-uri') args.redirectUris.push(argv[(i += 1)]);
    else if (arg === '--client-name') args.clientName = argv[(i += 1)];
    else if (arg === '--scope') args.scope = argv[(i += 1)];
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
    ...(args.scope ? {scope: args.scope} : {}),
    jwks: {keys: [publicJwk]}
  };

  console.log('Generated JWK (public):');
  console.log(JSON.stringify(publicJwk, null, 2));
  console.log('\nGenerated private key (PEM, keep secret, never commit):');
  console.log(privateKeyPem);
  console.log(`kid: ${kid}`);

  if (args.dryRun) {
    console.log('\n--dry-run set, skipping registration request. Payload that would be sent to /oauth/register:');
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
  console.log('\nAdd these to your .env (this is a separate client from WORF_CLIENT_ID, which stays as-is for the legacy password login):');
  console.log(`WORF_OAUTH_CLIENT_ID=${body.client_id}`);
  console.log(`WORF_OAUTH_KID=${kid}`);
  console.log(`WORF_OAUTH_PRIVATE_KEY=${privateKeyPem.replace(/\n/g, '\\n')}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
```

- [ ] **Step 2: Add a convenience npm script**

In `package.json`, inside `"scripts"`, add (after `"test:watch"`):

```json
    "register-oauth-client": "node scripts/register-oauth-client.mjs"
```

- [ ] **Step 3: Run it in dry-run mode to verify it works without hitting the network**

Run: `node scripts/register-oauth-client.mjs --dry-run --redirect-uri http://localhost:3000/api/auth/oauth/callback`
Expected: prints a `Generated JWK (public):` block with `"kty": "EC"`, `"crv": "P-256"`, a `Generated private key (PEM...` block containing `-----BEGIN PRIVATE KEY-----`, a `kid:` line, and ends with `--dry-run set, skipping registration request.` followed by the JSON payload (no network error, no crash).

- [ ] **Step 4: Commit**

```bash
git add scripts/register-oauth-client.mjs package.json
git commit -m "feat: add private_key_jwt client registration script"
```

---

## Task 7: Login route — PKCE-based `/oauth/authorize` redirect

**Files:**
- Modify: `app/api/auth/oauth/login/route.ts` (full rewrite of the existing `GET` handler)

**Interfaces:**
- Consumes: `generatePkcePair()`, `generateState()` from `lib/server/pkce.ts` (Task 2); `PKCE_VERIFIER_COOKIE`, `PKCE_STATE_COOKIE`, `PKCE_COOKIE_OPTIONS` from `lib/utils/constants.ts` (Task 5).
- Produces: sets `PKCE_VERIFIER_COOKIE` and `PKCE_STATE_COOKIE` cookies, consumed by Task 8's callback route.

- [ ] **Step 1: Replace the file contents**

```typescript
import {NextRequest, NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {generatePkcePair, generateState} from '@/lib/server/pkce';
import {PKCE_COOKIE_OPTIONS, PKCE_STATE_COOKIE, PKCE_VERIFIER_COOKIE} from '@/lib/utils/constants';

export async function GET(request: NextRequest) {
  const apiBase = process.env.WORF_API_URL;
  const clientId = process.env.WORF_OAUTH_CLIENT_ID;
  const locale = request.nextUrl.searchParams.get('locale') ?? process.env.NEXT_PUBLIC_DEFAULT_LOCALE ?? 'hu';

  if (!apiBase) {
    return NextResponse.json({message: 'WORF_API_URL is not configured'}, {status: 500});
  }
  if (!clientId) {
    return NextResponse.json({message: 'WORF_OAUTH_CLIENT_ID is not configured'}, {status: 500});
  }

  const appBase = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
  const callbackUrl = new URL('/api/auth/oauth/callback', appBase.endsWith('/') ? appBase : `${appBase}/`);
  callbackUrl.searchParams.set('locale', locale);

  const {codeVerifier, codeChallenge} = generatePkcePair();
  const state = generateState();

  const jar = await cookies();
  jar.set(PKCE_VERIFIER_COOKIE, codeVerifier, PKCE_COOKIE_OPTIONS);
  jar.set(PKCE_STATE_COOKIE, state, PKCE_COOKIE_OPTIONS);

  const authorizeUrl = new URL('/oauth/authorize', apiBase.endsWith('/') ? apiBase : `${apiBase}/`);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('redirect_uri', callbackUrl.toString());
  authorizeUrl.searchParams.set('code_challenge', codeChallenge);
  authorizeUrl.searchParams.set('code_challenge_method', 'S256');
  authorizeUrl.searchParams.set('state', state);

  const scopes = (process.env.WORF_SCOPES ?? '').trim();
  if (scopes) {
    authorizeUrl.searchParams.set('scope', scopes.split(',').map((s) => s.trim()).filter(Boolean).join(' '));
  }

  return NextResponse.redirect(authorizeUrl);
}
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit` and `npm run lint`
Expected: no new errors attributable to this file.

- [ ] **Step 3: Manual smoke test**

With `npm run dev` running and `.env` pointing at a reachable `WORF_API_URL`, open `http://localhost:3000/api/auth/oauth/login` in a browser and confirm it redirects to `{WORF_API_URL}/oauth/authorize?response_type=code&client_id=...&redirect_uri=...&code_challenge=...&code_challenge_method=S256&state=...`, and that the browser now holds `worf_pkce_verifier` and `worf_pkce_state` cookies (check via devtools Application tab).

- [ ] **Step 4: Commit**

```bash
git add app/api/auth/oauth/login/route.ts
git commit -m "feat: redirect to PKCE-based /oauth/authorize"
```

---

## Task 8: Callback route — authorization_code exchange

**Files:**
- Modify: `app/api/auth/oauth/callback/route.ts` (full rewrite of the existing `GET` handler)

**Interfaces:**
- Consumes: `setAuthCookies` from `lib/server/auth.ts` (existing); `exchangeAuthorizationCode` from `lib/server/oauth-token.ts` (Task 4); `PKCE_VERIFIER_COOKIE`, `PKCE_STATE_COOKIE`, `AUTH_ORIGIN_COOKIE`, `AUTH_ORIGIN_COOKIE_OPTIONS`, `OAUTH_AUTH_ORIGIN` from `lib/utils/constants.ts` (Task 5).
- Produces: sets `AUTH_ORIGIN_COOKIE=oauth`, consumed by Task 9's refresh route.

- [ ] **Step 1: Replace the file contents**

```typescript
import {NextRequest, NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {setAuthCookies} from '@/lib/server/auth';
import {exchangeAuthorizationCode} from '@/lib/server/oauth-token';
import {
  AUTH_ORIGIN_COOKIE,
  AUTH_ORIGIN_COOKIE_OPTIONS,
  OAUTH_AUTH_ORIGIN,
  PKCE_STATE_COOKIE,
  PKCE_VERIFIER_COOKIE
} from '@/lib/utils/constants';

export async function GET(request: NextRequest) {
  const locale = request.nextUrl.searchParams.get('locale') ?? process.env.NEXT_PUBLIC_DEFAULT_LOCALE ?? 'hu';
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const error = request.nextUrl.searchParams.get('error');
  const errorDescription = request.nextUrl.searchParams.get('error_description');

  const failWith = (message: string) => {
    const redirectUrl = new URL(`/${locale}/auth/login`, request.nextUrl.origin);
    redirectUrl.searchParams.set('error', message);
    return NextResponse.redirect(redirectUrl);
  };

  const jar = await cookies();
  const storedVerifier = jar.get(PKCE_VERIFIER_COOKIE)?.value;
  const storedState = jar.get(PKCE_STATE_COOKIE)?.value;
  jar.delete(PKCE_VERIFIER_COOKIE);
  jar.delete(PKCE_STATE_COOKIE);

  if (error) {
    return failWith(errorDescription ?? error);
  }

  if (!code || !state) {
    return failWith('Missing code or state');
  }

  if (!storedVerifier || !storedState || state !== storedState) {
    return failWith('Invalid OAuth state');
  }

  const appBase = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
  const callbackUrl = new URL('/api/auth/oauth/callback', appBase.endsWith('/') ? appBase : `${appBase}/`);
  callbackUrl.searchParams.set('locale', locale);

  const {status, data} = await exchangeAuthorizationCode({
    code,
    redirectUri: callbackUrl.toString(),
    codeVerifier: storedVerifier
  });

  if (status < 200 || status >= 300 || !data.access_token || !data.refresh_token) {
    return failWith(data.error_description ?? data.error ?? 'OAuth token exchange failed');
  }

  await setAuthCookies({access_token: data.access_token, refresh_token: data.refresh_token});
  jar.set(AUTH_ORIGIN_COOKIE, OAUTH_AUTH_ORIGIN, AUTH_ORIGIN_COOKIE_OPTIONS);

  const redirectUrl = new URL(`/${locale}/dashboard`, request.nextUrl.origin);
  return NextResponse.redirect(redirectUrl);
}
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit` and `npm run lint`
Expected: no new errors attributable to this file.

- [ ] **Step 3: Manual smoke test**

Complete a full login via `http://localhost:3000/api/auth/oauth/login` against the real backend (login/MFA/consent on the backend-hosted pages), and confirm: the browser lands on `/{locale}/dashboard`, `worf_access_token`/`worf_refresh_token`/`worf_auth_origin` cookies are set (`worf_auth_origin` = `oauth`), and `worf_pkce_verifier`/`worf_pkce_state` are gone.

- [ ] **Step 4: Commit**

```bash
git add app/api/auth/oauth/callback/route.ts
git commit -m "feat: exchange authorization_code via /oauth/token with client_assertion"
```

---

## Task 9: Refresh route — route by session origin

**Files:**
- Modify: `app/api/auth/token/route.ts` (rewrite `refreshAccessToken`; `POST`/`GET` handlers and `sanitizeRedirectPath` stay as they are)

**Interfaces:**
- Consumes: `refreshWithOAuthToken` from `lib/server/oauth-token.ts` (Task 4); `AUTH_ORIGIN_COOKIE`, `AUTH_ORIGIN_COOKIE_OPTIONS`, `OAUTH_AUTH_ORIGIN` from `lib/utils/constants.ts` (Task 5); existing `getAuthClientPayload`, `MISSING_AUTH_CLIENT_MESSAGE`, `callWorfApi`, `clearAuthCookies`, `setAuthCookies`, `getServerRefreshToken`.

- [ ] **Step 1: Replace `refreshAccessToken` and its imports**

Replace the top of `app/api/auth/token/route.ts` (imports through the end of `refreshAccessToken`) with:

```typescript
import {NextRequest, NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {clearAuthCookies, jsonWithStatus, setAuthCookies} from '@/lib/server/auth';
import {getAuthClientPayload, MISSING_AUTH_CLIENT_MESSAGE} from '@/lib/server/auth-client';
import {refreshWithOAuthToken} from '@/lib/server/oauth-token';
import {callWorfApi} from '@/lib/server/worf';
import {AUTH_ORIGIN_COOKIE, AUTH_ORIGIN_COOKIE_OPTIONS, OAUTH_AUTH_ORIGIN} from '@/lib/utils/constants';
import {getServerRefreshToken} from '@/lib/utils/cookies';

const parseScopes = () =>
  (process.env.WORF_SCOPES ?? '')
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean);

type RefreshResult = {
  status: number;
  data: unknown;
};

async function refreshAccessToken(): Promise<RefreshResult> {
  const refreshToken = await getServerRefreshToken();
  if (!refreshToken) {
    await clearAuthCookies();
    return {status: 401, data: {message: 'Missing refresh token'}};
  }

  const jar = await cookies();
  const authOrigin = jar.get(AUTH_ORIGIN_COOKIE)?.value;

  if (authOrigin === OAUTH_AUTH_ORIGIN) {
    const {status, data} = await refreshWithOAuthToken(refreshToken);
    const tokens = data as {access_token?: string; refresh_token?: string};

    if (status >= 200 && status < 300 && tokens.access_token) {
      await setAuthCookies({access_token: tokens.access_token, refresh_token: tokens.refresh_token});
      jar.set(AUTH_ORIGIN_COOKIE, OAUTH_AUTH_ORIGIN, AUTH_ORIGIN_COOKIE_OPTIONS);
    } else if (status === 401 || status === 403) {
      await clearAuthCookies();
      jar.delete(AUTH_ORIGIN_COOKIE);
    }

    return {status, data};
  }

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
```

Leave the rest of the file (`sanitizeRedirectPath`, the exported `POST`, and the exported `GET`) exactly as they are today.

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit` and `npm run lint`
Expected: no new errors attributable to this file.

- [ ] **Step 3: Manual smoke test**

After an OAuth login (Task 8's smoke test), call `POST http://localhost:3000/api/auth/token` (e.g. via devtools console `fetch('/api/auth/token', {method: 'POST'})`) and confirm it returns 2xx with a new `access_token`, and that devtools shows the request went to `/oauth/token` server-side (check server logs / add a temporary `console.log` if the network tab doesn't show server-to-server calls) rather than `/v1/auth/token`. Then log in via the legacy password form (if reachable in this environment) and confirm its refresh still goes to `/v1/auth/token` and still works.

- [ ] **Step 4: Commit**

```bash
git add app/api/auth/token/route.ts
git commit -m "feat: route OAuth-origin session refresh to /oauth/token"
```

---

## Task 10: Env file documentation

**Files:**
- Modify: `.env`, `.env.local.example`

**Interfaces:**
- Consumes: none (documentation/config only).

- [ ] **Step 1: Update `.env.local.example`**

Replace its contents with:

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

Note `WORF_CLIENT_ID`/`WORF_CLIENT_SECRET` and `WORF_OAUTH_CLIENT_ID`/`WORF_OAUTH_PRIVATE_KEY`/`WORF_OAUTH_KID` are **two separate, independently registered clients** — the legacy password-login client keeps its existing `client_id`+`client_secret`, and the new `private_key_jwt` client (Task 6's script output) gets its own `client_id` in `WORF_OAUTH_CLIENT_ID`. Do not merge them or reuse one client_id for both.

- [ ] **Step 2: Add placeholders to the local `.env`**

Add three lines after the existing `WORF_CLIENT_ID`/`WORF_CLIENT_SECRET` lines in `.env` (do not remove or change `WORF_CLIENT_ID`/`WORF_CLIENT_SECRET` — the legacy password flow still needs them exactly as they are):

```
WORF_OAUTH_CLIENT_ID=
WORF_OAUTH_PRIVATE_KEY=
WORF_OAUTH_KID=
```

Leave all three empty until `npm run register-oauth-client -- --redirect-uri http://localhost:3000/api/auth/oauth/callback` (Task 6's script) has been run for real against `WORF_API_URL`, and its printed `client_id` (into `WORF_OAUTH_CLIENT_ID`), `kid`, and private key have been pasted in.

- [ ] **Step 3: Verify**

Run: `grep -c "WORF_OAUTH_" .env .env.local.example`
Expected: `4` for each file (`WORF_OAUTH_CLIENT_ID`, `WORF_OAUTH_PRIVATE_KEY`, `WORF_OAUTH_KID`, `WORF_OAUTH_REDIRECT_URI`).

- [ ] **Step 4: Commit**

```bash
git add .env.local.example
git commit -m "docs: document WORF_OAUTH_CLIENT_ID, WORF_OAUTH_PRIVATE_KEY and WORF_OAUTH_KID env vars"
```

Note: `.env` is git-ignored (`.gitignore:37`) — only `.env.local.example` is committed; the local `.env` edit in Step 2 is a working-copy change, not a commit.

---

## Full Test Suite

- [ ] **Final step: run everything**

Run: `npm run test`
Expected: all tests pass, including the four new suites from Tasks 2-5.

Run: `npx tsc --noEmit`
Expected: no errors.
