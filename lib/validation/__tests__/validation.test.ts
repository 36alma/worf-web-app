import {describe, it, expect} from 'vitest';
import {
  EMAIL_PATTERN,
  FULL_NAME_PATTERN,
  SAFE_FILENAME_PATTERN
} from '../patterns';
import {checkPasswordRules, isPasswordValid, failedPasswordRules} from '../password';
import {
  emailSchema,
  fullNameSchema,
  passwordSchema,
  filenameSchema,
  withPasswordMatch
} from '../schemas';
import {requiredText, optionalText} from '../guardrails';
import * as z from 'zod';

describe('EMAIL_PATTERN', () => {
  it('elfogadja az alap e-mailt', () => {
    expect(EMAIL_PATTERN.test('user@example.com')).toBe(true);
  });

  it('elfogadja a Unicode local-partot (backend \\w Unicode)', () => {
    expect(EMAIL_PATTERN.test('felhasználó@x.hu')).toBe(true);
  });

  it('elutasítja a hibás formátumokat', () => {
    expect(EMAIL_PATTERN.test('user@@example')).toBe(false);
    expect(EMAIL_PATTERN.test('user example.com')).toBe(false);
    expect(EMAIL_PATTERN.test('user@example')).toBe(false);
  });
});

describe('FULL_NAME_PATTERN', () => {
  it('elfogadja a valid magyar neveket', () => {
    expect(FULL_NAME_PATTERN.test('Kovács-Nagy Béla')).toBe(true);
    expect(FULL_NAME_PATTERN.test('Szabó János Péter')).toBe(true);
  });

  it('elutasítja a kisbetűst és az egyszavas nevet', () => {
    expect(FULL_NAME_PATTERN.test('kovács béla')).toBe(false);
    expect(FULL_NAME_PATTERN.test('Kovács')).toBe(false); // záró + → legalább 2 névelem
  });
});

describe('checkPasswordRules', () => {
  it('minden szabály teljesül a jó jelszónál', () => {
    expect(isPasswordValid('Password1!')).toBe(true);
    expect(failedPasswordRules('Password1!')).toEqual([]);
  });

  it('pontosan a hiányzó szabályt jelzi (csak nagybetű hiányzik)', () => {
    const results = checkPasswordRules('password1!');
    expect(results.uppercase).toBe(false);
    expect(results.lowercase).toBe(true);
    expect(results.digit).toBe(true);
    expect(results.symbol).toBe(true);
    expect(results.min_length).toBe(true);
    expect(failedPasswordRules('password1!')).toEqual(['uppercase']);
  });

  it('a szám és szimbólum hiánya külön jelenik meg', () => {
    expect(checkPasswordRules('Password').digit).toBe(false);
    expect(checkPasswordRules('Password1').symbol).toBe(false);
  });

  it('ékezetes betű NEM számít szimbólumnak (Unicode \\w, mint a backend)', () => {
    // "Passwörd1" — az ö betű, nincs valódi szimbólum → symbol szabály bukik
    expect(checkPasswordRules('Passwörd1').symbol).toBe(false);
  });

  it('a 8-nál rövidebb jelszó a min_length szabályt bukja', () => {
    expect(checkPasswordRules('Pass1!').min_length).toBe(false);
  });
});

describe('SAFE_FILENAME_PATTERN', () => {
  it('elfogadja a biztonságos fájlneveket', () => {
    expect(SAFE_FILENAME_PATTERN.test('report (final).pdf')).toBe(true);
    expect(SAFE_FILENAME_PATTERN.test('photo_2024.jpg')).toBe(true);
  });

  it('elutasítja a nem engedélyezett karaktereket', () => {
    expect(SAFE_FILENAME_PATTERN.test('report#1.pdf')).toBe(false);
    expect(SAFE_FILENAME_PATTERN.test('photo/2024.jpg')).toBe(false);
  });
});

const firstError = (result: z.ZodSafeParseResult<unknown>) =>
  result.success ? null : result.error.issues[0]?.message;

describe('zod sémák — stabil kulcsokat adnak', () => {
  it('emailSchema', () => {
    expect(emailSchema.safeParse('user@example.com').success).toBe(true);
    expect(firstError(emailSchema.safeParse('bad'))).toBe('email_invalid');
  });

  it('fullNameSchema', () => {
    expect(fullNameSchema.safeParse('Szabó János').success).toBe(true);
    expect(firstError(fullNameSchema.safeParse('Kovács'))).toBe('fullname_invalid');
  });

  it('passwordSchema minden hiányzó szabályt külön issue-ként ad vissza', () => {
    const result = passwordSchema.safeParse('short');
    expect(result.success).toBe(false);
    if (!result.success) {
      const keys = result.error.issues.map((i) => i.message);
      expect(keys).toContain('password_min_length');
      expect(keys).toContain('password_uppercase');
      expect(keys).toContain('password_digit');
      expect(keys).toContain('password_symbol');
    }
    expect(passwordSchema.safeParse('Password1!').success).toBe(true);
  });

  it('filenameSchema — regex és path-traversal külön kulcs', () => {
    expect(filenameSchema.safeParse('report (final).pdf').success).toBe(true);
    expect(firstError(filenameSchema.safeParse('report#1.pdf'))).toBe('filename_invalid');
    expect(firstError(filenameSchema.safeParse('../etc/passwd'))).toBe('filename_invalid');
  });

  it('withPasswordMatch — eltérő jelszó password_mismatch', () => {
    const schema = withPasswordMatch(
      z.object({newpassword: z.string(), newpassword_rep: z.string()})
    );
    expect(schema.safeParse({newpassword: 'a', newpassword_rep: 'a'}).success).toBe(true);
    const result = schema.safeParse({newpassword: 'a', newpassword_rep: 'b'});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('password_mismatch');
      expect(result.error.issues[0].path).toEqual(['newpassword_rep']);
    }
  });
});

describe('guardrails', () => {
  it('requiredText — üres/whitespace tiltás, max hossz, vezérlőkarakter', () => {
    expect(requiredText().safeParse('Csoport').success).toBe(true);
    expect(firstError(requiredText().safeParse('   '))).toBe('required');
    expect(firstError(requiredText(5).safeParse('túl hosszú név'))).toBe('too_long');
    expect(firstError(requiredText().safeParse('rossz\x00kar'))).toBe('invalid_chars');
  });

  it('optionalText — üres megengedett', () => {
    expect(optionalText().safeParse('').success).toBe(true);
    expect(firstError(optionalText(3).safeParse('túl hosszú'))).toBe('too_long');
  });

  it('a sortörés/tab NEM érvénytelen karakter (többsoros mezők)', () => {
    expect(optionalText().safeParse('első sor\nmásodik sor\ttab').success).toBe(true);
    expect(requiredText().safeParse('több\nsoros\rkomment').success).toBe(true);
  });
});
