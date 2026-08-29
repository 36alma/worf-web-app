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
