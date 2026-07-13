import * as z from 'zod';
import {CONTROL_CHARS_PATTERN} from './patterns';

/**
 * Könnyű "guardrail" sémák azokhoz a mezőkhöz, amikre a backend NEM ad regexet
 * (nevek, címek, leírások, kommentek). Szándékosan NINCS tartalmi regex, hogy a
 * frontend sose utasítson el olyat, amit a backend elfogadna — csak triviális,
 * biztonságos szabályok: nem üres (ha kötelező), max hossz, nincs vezérlőkarakter.
 *
 * Az üzenetek stabil i18n kulcsok: "required" | "too_long" | "invalid_chars".
 */

const DEFAULT_MAX_LENGTH = 500;

const noControlChars = (value: string) => !CONTROL_CHARS_PATTERN.test(value);

/** Kötelező szöveges mező: trim után nem lehet üres; max hossz; nincs vezérlőkarakter. */
export function requiredText(maxLength: number = DEFAULT_MAX_LENGTH) {
  return z
    .string()
    .refine((value) => value.trim().length > 0, {message: 'required'})
    .refine((value) => value.trim().length <= maxLength, {message: 'too_long'})
    .refine(noControlChars, {message: 'invalid_chars'});
}

/** Opcionális szöveges mező: üres megengedett; ha van tartalom, max hossz + nincs vezérlőkarakter. */
export function optionalText(maxLength: number = DEFAULT_MAX_LENGTH) {
  return z
    .string()
    .refine((value) => value.trim().length <= maxLength, {message: 'too_long'})
    .refine(noControlChars, {message: 'invalid_chars'});
}
