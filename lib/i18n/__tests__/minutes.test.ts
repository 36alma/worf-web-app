import {describe, expect, it} from 'vitest';
import {translateMinutesApiError, translateMinutesStatus, translateParticipantRole} from '../minutes';

function fakeTranslator(known: Record<string, string>) {
  const t = ((key: string) => known[key] ?? `MISSING:${key}`) as any;
  t.has = (key: string) => key in known;
  return t;
}

describe('translateMinutesStatus', () => {
  it('maps a known status to its translation', () => {
    const t = fakeTranslator({'status_enum.DRAFT': 'Piszkozat'});
    expect(translateMinutesStatus(t, 'DRAFT')).toBe('Piszkozat');
  });

  it('falls back to the raw status for an unknown value', () => {
    const t = fakeTranslator({});
    expect(translateMinutesStatus(t, 'WEIRD')).toBe('WEIRD');
  });
});

describe('translateParticipantRole', () => {
  it('maps a known role to its translation', () => {
    const t = fakeTranslator({'role_enum.WITNESS': 'Hitelesítő'});
    expect(translateParticipantRole(t, 'WITNESS')).toBe('Hitelesítő');
  });

  it('falls back to the raw role for an unknown value', () => {
    const t = fakeTranslator({});
    expect(translateParticipantRole(t, 'WEIRD')).toBe('WEIRD');
  });
});

describe('translateMinutesApiError', () => {
  it('maps a known status code to its translation', () => {
    const t = fakeTranslator({'errors.api.422': 'Érvénytelen adat.'});
    const error = {response: {status: 422}};
    expect(translateMinutesApiError(t, error, 'errors.default')).toBe('Érvénytelen adat.');
  });

  it('falls back to the default key for an unmapped status', () => {
    const t = fakeTranslator({'errors.default': 'Ismeretlen hiba.'});
    const error = {response: {status: 418}};
    expect(translateMinutesApiError(t, error, 'errors.default')).toBe('Ismeretlen hiba.');
  });

  it('falls back to the default key when there is no response at all', () => {
    const t = fakeTranslator({'errors.default': 'Ismeretlen hiba.'});
    expect(translateMinutesApiError(t, new Error('network'), 'errors.default')).toBe('Ismeretlen hiba.');
  });
});
