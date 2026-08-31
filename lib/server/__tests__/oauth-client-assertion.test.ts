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

  it('returns null when the audience is empty', async () => {
    await expect(buildClientAssertion('')).resolves.toBeNull();
  });
});
