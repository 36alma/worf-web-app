import * as z from 'zod';
import {
  EMAIL_PATTERN,
  FULL_NAME_PATTERN,
  SAFE_FILENAME_PATTERN,
  FILENAME_TRAVERSAL_TOKENS
} from './patterns';
import {checkPasswordRules, PASSWORD_RULE_IDS} from './password';

/**
 * A séma-üzenetek NEM lefordított szövegek, hanem stabil i18n KULCSOK a `validation`
 * namespace alól (pl. "email_invalid"). A form `t('validation.<kulcs>')`-ként rendereli.
 */

export const emailSchema = z
  .string()
  .refine((value) => EMAIL_PATTERN.test(value), {message: 'email_invalid'});

export const fullNameSchema = z
  .string()
  .refine((value) => FULL_NAME_PATTERN.test(value), {message: 'fullname_invalid'});

/**
 * Opcionális variánsok — üres (vagy csak whitespace) érték megengedett, azaz "ne változzon"
 * szemantika (pl. profil-szerkesztés). Ha van tartalom, a backend-mintának meg kell felelnie.
 */
export const optionalEmailSchema = z
  .string()
  .refine((value) => value.trim() === '' || EMAIL_PATTERN.test(value), {message: 'email_invalid'});

export const optionalFullNameSchema = z
  .string()
  .refine((value) => value.trim() === '' || FULL_NAME_PATTERN.test(value), {
    message: 'fullname_invalid'
  });

/**
 * Jelszó séma — MINDEN meg nem felelt szabályhoz külön issue-t ad (nem short-circuit),
 * hogy egyszerre látszódjon az összes hiányzó követelmény. Az üzenet kulcsa:
 * `password_min_length` | `password_lowercase` | `password_uppercase` | `password_digit` | `password_symbol`.
 */
export const passwordSchema = z.string().superRefine((value, ctx) => {
  const results = checkPasswordRules(value);
  for (const ruleId of PASSWORD_RULE_IDS) {
    if (!results[ruleId]) {
      ctx.addIssue({code: 'custom', message: `password_${ruleId}`});
    }
  }
});

export const filenameSchema = z
  .string()
  .refine((value) => SAFE_FILENAME_PATTERN.test(value), {message: 'filename_invalid'})
  .refine(
    (value) => !FILENAME_TRAVERSAL_TOKENS.some((token) => value.includes(token)),
    {message: 'filename_path'}
  );

/**
 * Két jelszómező egyezés-ellenőrzése tetszőleges objektum-sémára.
 * A hibát a `newpassword_rep` mezőre teszi `password_mismatch` kulccsal.
 */
export function withPasswordMatch<
  T extends z.ZodObject<{newpassword: z.ZodTypeAny; newpassword_rep: z.ZodTypeAny}>
>(schema: T) {
  return schema.refine((data) => data.newpassword === data.newpassword_rep, {
    message: 'password_mismatch',
    path: ['newpassword_rep']
  });
}
