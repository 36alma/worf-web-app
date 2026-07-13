import {
  PASSWORD_LOWERCASE,
  PASSWORD_UPPERCASE,
  PASSWORD_DIGIT,
  PASSWORD_SYMBOL,
  PASSWORD_MIN_LENGTH
} from './patterns';

/** Egy-egy jelszó-szabály azonosítója (egyben i18n kulcs-utótag: `validation.password_<id>`). */
export type PasswordRuleId = 'min_length' | 'lowercase' | 'uppercase' | 'digit' | 'symbol';

/** A szabályok fix sorrendje a checklist rendereléséhez. */
export const PASSWORD_RULE_IDS: readonly PasswordRuleId[] = [
  'min_length',
  'lowercase',
  'uppercase',
  'digit',
  'symbol'
];

export type PasswordRuleResults = Record<PasswordRuleId, boolean>;

/**
 * Ellenőrzi az összes jelszó-szabályt egyszerre (nem áll meg az első hibánál),
 * hogy az élő checklist minden sorát pontosan meg tudjuk jeleníteni.
 */
export function checkPasswordRules(password: string): PasswordRuleResults {
  return {
    min_length: password.length >= PASSWORD_MIN_LENGTH,
    lowercase: PASSWORD_LOWERCASE.test(password),
    uppercase: PASSWORD_UPPERCASE.test(password),
    digit: PASSWORD_DIGIT.test(password),
    symbol: PASSWORD_SYMBOL.test(password)
  };
}

/** Igaz, ha minden jelszó-szabály teljesül. */
export function isPasswordValid(password: string): boolean {
  const results = checkPasswordRules(password);
  return PASSWORD_RULE_IDS.every((id) => results[id]);
}

/** A meg NEM felelt szabályok azonosítói (a fix sorrendben). */
export function failedPasswordRules(password: string): PasswordRuleId[] {
  const results = checkPasswordRules(password);
  return PASSWORD_RULE_IDS.filter((id) => !results[id]);
}
