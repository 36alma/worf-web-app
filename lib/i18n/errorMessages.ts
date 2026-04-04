import huMessages from '@/messages/hu.json';
import enMessages from '@/messages/en.json';

export type ErrorLocale = 'hu' | 'en';

export interface ErrorMessages {
  '404': {title: string; message: string};
  '403': {title: string; message: string};
  '500': {title: string; message: string};
  '503': {title: string; message: string};
  generic: {title: string; message: string};
  actions: {goBack: string; goHome: string; refresh: string};
  help: {prefix: string; contact: string};
}

function inferLocale(value: string | null | undefined): ErrorLocale {
  return value === 'en' ? 'en' : 'hu';
}

export function resolveErrorLocale(value: string | null | undefined): ErrorLocale {
  return inferLocale(value);
}

export function getErrorMessages(locale: string | null | undefined): ErrorMessages {
  return inferLocale(locale) === 'en'
    ? (enMessages.errors as ErrorMessages)
    : (huMessages.errors as ErrorMessages);
}