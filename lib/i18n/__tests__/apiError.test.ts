import {describe, expect, it, vi} from 'vitest';
import {translateApiError} from '../apiError';

function fakeTranslator(known: Record<string, string>) {
  const t = ((key: string) => known[key] ?? `MISSING:${key}`) as any;
  t.has = (key: string) => key in known;
  return t;
}

describe('translateApiError', () => {
  it('maps a known status code to its translation', () => {
    const t = fakeTranslator({'errors.api.404': 'Not found.'});
    const error = {response: {status: 404}};
    expect(translateApiError(t, error, 'errors.default')).toBe('Not found.');
  });

  it('returns the raw backend detail for a 409 conflict', () => {
    const t = fakeTranslator({'errors.default': 'Unknown error.'});
    const error = {response: {status: 409, data: {detail: 'Folder is already shared with this user.'}}};
    expect(translateApiError(t, error, 'errors.default')).toBe('Folder is already shared with this user.');
  });

  it('falls back to the default key when the 409 has no detail', () => {
    const t = fakeTranslator({'errors.default': 'Unknown error.'});
    const error = {response: {status: 409, data: {}}};
    expect(translateApiError(t, error, 'errors.default')).toBe('Unknown error.');
  });

  it('falls back to the default key for an unmapped status', () => {
    const t = fakeTranslator({'errors.default': 'Unknown error.'});
    const error = {response: {status: 418}};
    expect(translateApiError(t, error, 'errors.default')).toBe('Unknown error.');
  });

  it('falls back to the default key when there is no response at all', () => {
    const t = fakeTranslator({'errors.default': 'Unknown error.'});
    expect(translateApiError(t, new Error('network down'), 'errors.default')).toBe('Unknown error.');
  });
});
