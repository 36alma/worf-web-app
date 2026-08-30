#!/usr/bin/env node
// One-off setup: generates an ES256 keypair and registers a private_key_jwt
// OAuth client with the Worf authorization server (RFC 7591 dynamic client
// registration). Prints the client_id, kid and private key for .env — nothing
// is written to disk.
//
//   node scripts/register-oauth-client.mjs --dry-run --redirect-uri http://localhost:3000/api/auth/oauth/callback
//
// Without --dry-run this creates a real client on the server.
import {webcrypto} from 'node:crypto';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const {subtle} = webcrypto;

/**
 * Plain `node` does not read .env the way `next` does, so load the same files
 * Next.js would, with the same precedence: .env, then .env.local on top, and
 * anything the shell exported explicitly wins over both.
 */
function loadEnvFiles() {
  const shellEnv = {...process.env};

  for (const name of ['.env', '.env.local']) {
    const path = fileURLToPath(new URL(`../${name}`, import.meta.url));
    if (!existsSync(path)) continue;
    try {
      process.loadEnvFile(path);
    } catch (error) {
      console.warn(`Could not read ${name}: ${error.message}`);
    }
  }

  Object.assign(process.env, shellEnv);
}

function base64url(buffer) {
  return Buffer.from(buffer).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function derToPem(der, label) {
  const base64 = der.toString('base64');
  const lines = base64.match(/.{1,64}/g) ?? [];
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----\n`;
}

async function computeJwkThumbprint(jwk) {
  // RFC 7638: required members only, lexicographically ordered, no whitespace.
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
  loadEnvFiles();

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

  const registerUrl = apiBase
    ? new URL('/oauth/register', apiBase.endsWith('/') ? apiBase : `${apiBase}/`)
    : null;

  if (args.dryRun) {
    console.log(`\n--dry-run set, skipping registration. Target: ${registerUrl ?? '(WORF_API_URL is not set)'}`);
    console.log('Payload that would be sent:');
    console.log(JSON.stringify(registrationPayload, null, 2));
    return;
  }

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
