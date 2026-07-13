'use client';

import {useCallback, useState} from 'react';
import {useTranslations} from 'next-intl';
import type {ZodType} from 'zod';

/**
 * Mező → zod séma leképezés. A sémák üzenetei stabil i18n KULCSOK a `validation`
 * namespace alól (lásd lib/validation). Építsd useMemo-val a formban, hogy a
 * callback-ek referenciái stabilak legyenek.
 */
export type ValidationSchemas = Record<string, ZodType>;

export type FieldErrors = Record<string, string[]>;

const dedupe = (values: string[]) => Array.from(new Set(values));

/**
 * Könnyű validáló hook manuális (useState-alapú) űrlapokhoz. A hibaüzeneteket a
 * `validation` namespace-ből fordítja, így a `errors` már megjeleníthető szövegeket tartalmaz.
 * - `validateField(name, value)` — blur-nél egy mezőre; true, ha érvényes.
 * - `validateAll(values)` — submit-nél a teljes űrlapra; true, ha minden érvényes.
 */
export function useFieldValidation(schemas: ValidationSchemas) {
  const t = useTranslations('validation');
  const [errors, setErrors] = useState<FieldErrors>({});

  const messagesFor = useCallback(
    // A validation namespace kulcsai dinamikusak itt; a szigorúan típusos next-intl
    // kulcs-ellenőrzést a `as never` kerüli meg (futásidőben valódi kulcs-string).
    (keys: string[]) => dedupe(keys).map((key) => t(key as never)),
    [t]
  );

  const validateField = useCallback(
    (name: string, value: unknown): boolean => {
      const schema = schemas[name];
      if (!schema) return true;

      const result = schema.safeParse(value);
      setErrors((prev) => {
        const next = {...prev};
        if (result.success) {
          delete next[name];
        } else {
          next[name] = messagesFor(result.error.issues.map((issue) => issue.message));
        }
        return next;
      });
      return result.success;
    },
    [schemas, messagesFor]
  );

  const validateAll = useCallback(
    (values: Record<string, unknown>): boolean => {
      const nextErrors: FieldErrors = {};
      let ok = true;

      for (const name of Object.keys(schemas)) {
        const result = schemas[name].safeParse(values[name]);
        if (!result.success) {
          ok = false;
          nextErrors[name] = messagesFor(result.error.issues.map((issue) => issue.message));
        }
      }

      setErrors(nextErrors);
      return ok;
    },
    [schemas, messagesFor]
  );

  const clearError = useCallback((name: string) => {
    setErrors((prev) => {
      if (!(name in prev)) return prev;
      const next = {...prev};
      delete next[name];
      return next;
    });
  }, []);

  const resetErrors = useCallback(() => setErrors({}), []);

  return {errors, validateField, validateAll, clearError, resetErrors};
}
