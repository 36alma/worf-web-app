import {randomUUID} from 'node:crypto';
import {importPKCS8, SignJWT} from 'jose';

export const CLIENT_ASSERTION_TYPE = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer';

// RFC 7523 allows up to 300s; a short window keeps the replay surface small.
const CLIENT_ASSERTION_TTL_SECONDS = 60;

/**
 * Signs a fresh private_key_jwt client assertion for one token request.
 * The audience must be the discovered token endpoint, and every call gets a new
 * jti — assertions are never cached or reused.
 * Returns null when the OAuth client is not configured.
 */
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
