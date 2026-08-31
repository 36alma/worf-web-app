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
