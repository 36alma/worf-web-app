import {describe, expect, it} from 'vitest';
import {checkTagAdditions, normalizeTag, parseTagInput, sortTags, tagKey, validateTag} from '../tags';

describe('normalizeTag / tagKey', () => {
  it('trims and collapses inner whitespace like the server', () => {
    expect(normalizeTag('  Éves   terv ')).toBe('Éves terv');
  });

  it('treats different casing as the same tag', () => {
    expect(tagKey('Pénzügy')).toBe(tagKey(' pénzügy '));
  });
});

describe('parseTagInput', () => {
  it('splits on commas and semicolons, drops blanks', () => {
    expect(parseTagInput('Pénzügy, 2026 ;; Éves   terv,')).toEqual(['Pénzügy', '2026', 'Éves terv']);
  });

  it('drops duplicates inside the input and of the existing tags, keeping the first spelling', () => {
    expect(parseTagInput('pénzügy, Új, új', ['Pénzügy'])).toEqual(['Új']);
  });

  it('returns nothing for a blank input', () => {
    expect(parseTagInput('  , ;')).toEqual([]);
  });
});

describe('validateTag', () => {
  it('accepts a normal tag and one of exactly 50 characters', () => {
    expect(validateTag('Pénzügy')).toBeNull();
    expect(validateTag('a'.repeat(50))).toBeNull();
  });

  it('refuses an empty, an over-long and a control-character tag', () => {
    expect(validateTag('')).toBe('invalid');
    expect(validateTag('a'.repeat(51))).toBe('invalid');
    expect(validateTag('a\u0007b')).toBe('invalid');
  });
});

describe('checkTagAdditions', () => {
  const nine = Array.from({length: 9}, (_, i) => `t${i}`);

  it('lets a request through that stays within 10 tags', () => {
    expect(checkTagAdditions(nine, ['x'])).toBeNull();
  });

  it('refuses the whole request over the per-record limit — the server rejects it as a whole too', () => {
    expect(checkTagAdditions(nine, ['x', 'y'])).toBe('limit');
  });

  it('reports an invalid tag before the limit', () => {
    expect(checkTagAdditions(nine, ['x', ''])).toBe('invalid');
  });
});

describe('sortTags', () => {
  it('sorts by the UI language, not by code point', () => {
    expect(sortTags(['Pénzügy', 'Éves terv', 'Adó'], 'hu')).toEqual(['Adó', 'Éves terv', 'Pénzügy']);
  });
});
