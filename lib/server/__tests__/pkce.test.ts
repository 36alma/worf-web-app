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
