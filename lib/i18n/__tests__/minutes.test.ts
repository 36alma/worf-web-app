import {describe, expect, it} from 'vitest';
import {
  extractMinutesErrorCode,
  extractMinutesErrorIssues,
  hasMissingField,
  parseMinutesCode,
  translateMinutesApiError,
  translateMinutesErrorCode,
  translateMinutesStatus,
  translateParticipantRole
} from '../minutes';

/** A 422 whose `detail` is a stable machine-readable code. */
const codeError = (detail: unknown) => ({response: {status: 422, data: {detail}}});

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

  it('prefers the stable minutes.* code over the generic status message', () => {
    const t = fakeTranslator({
      'errors.api.422': 'A megadott adat érvénytelen.',
      'errors.code.witness_not_eligible': 'A hitelesítőnek nincs meg a szükséges joga.'
    });
    expect(translateMinutesApiError(t, codeError('minutes.witness_not_eligible'), 'errors.default')).toBe(
      'A hitelesítőnek nincs meg a szükséges joga.'
    );
  });

  it('treats a missing minute_taker_id validation list as the "minute taker required" code', () => {
    const t = fakeTranslator({
      'errors.api.422': 'A megadott adat érvénytelen.',
      'errors.code.minute_taker_required': 'Jegyzőkönyvvezető megadása kötelező.'
    });
    const error = codeError([{loc: ['body', 'minute_taker_id'], msg: 'Field required', type: 'missing'}]);
    expect(translateMinutesApiError(t, error, 'errors.default')).toBe('Jegyzőkönyvvezető megadása kötelező.');
  });

  it('falls back to the status message for a generic 422 (a list about another field)', () => {
    const t = fakeTranslator({'errors.api.422': 'A megadott adat érvénytelen.'});
    const error = codeError([{loc: ['body', 'subject'], msg: 'Field required'}]);
    expect(translateMinutesApiError(t, error, 'errors.default')).toBe('A megadott adat érvénytelen.');
  });
});

describe('extractMinutesErrorCode', () => {
  it('strips the minutes. prefix of a known code', () => {
    expect(extractMinutesErrorCode(codeError('minutes.restore_version_in_progress'))).toBe('restore_version_in_progress');
  });

  it('ignores an unknown code, a plain message and a validation list', () => {
    expect(extractMinutesErrorCode(codeError('minutes.something_new'))).toBeNull();
    expect(extractMinutesErrorCode(codeError('Validation failed.'))).toBeNull();
    expect(extractMinutesErrorCode(codeError([{loc: ['body', 'minute_taker_id']}]))).toBeNull();
    expect(extractMinutesErrorCode(new Error('network'))).toBeNull();
  });
});

describe('finalize refused over its witnesses (object detail)', () => {
  const objectError = codeError({
    code: 'minutes.witness_not_eligible',
    issues: [
      {participant_id: 'p1', code: 'minutes.witness_not_eligible'},
      {participant_id: 'p2', code: 'minutes.witness_requires_registered_user'}
    ]
  });

  it('reads the code out of the object detail', () => {
    expect(extractMinutesErrorCode(objectError)).toBe('witness_not_eligible');
  });

  it('translates the object detail through its code', () => {
    const t = fakeTranslator({
      'errors.api.422': 'A megadott adat érvénytelen.',
      'errors.code.witness_not_eligible': 'A hitelesítőnek nincs meg a szükséges joga.'
    });
    expect(translateMinutesApiError(t, objectError, 'errors.default')).toBe('A hitelesítőnek nincs meg a szükséges joga.');
  });

  it('lists every flagged witness by participant id', () => {
    expect(extractMinutesErrorIssues(objectError)).toEqual([
      {participantId: 'p1', code: 'witness_not_eligible'},
      {participantId: 'p2', code: 'witness_requires_registered_user'}
    ]);
  });

  it('keeps a witness whose code is unknown to this client, without a code', () => {
    const error = codeError({code: 'minutes.witness_not_eligible', issues: [{participant_id: 'p1', code: 'minutes.brand_new'}]});
    expect(extractMinutesErrorIssues(error)).toEqual([{participantId: 'p1', code: null}]);
  });

  it('skips malformed issues and answers empty for a string or list detail', () => {
    const malformed = codeError({code: 'minutes.witness_not_eligible', issues: [null, {code: 'x'}, {participant_id: 3}]});
    expect(extractMinutesErrorIssues(malformed)).toEqual([]);
    expect(extractMinutesErrorIssues(codeError('minutes.witness_required'))).toEqual([]);
    expect(extractMinutesErrorIssues(codeError([{loc: ['body']}]))).toEqual([]);
    expect(extractMinutesErrorIssues(new Error('network'))).toEqual([]);
  });

  it('ignores an object detail without a usable code', () => {
    expect(extractMinutesErrorCode(codeError({issues: []}))).toBeNull();
    expect(extractMinutesErrorCode(codeError({code: 42}))).toBeNull();
  });
});

describe('archive / trash / tag codes', () => {
  it.each([
    'archive_invalid_state',
    'not_archived',
    'archived_read_only',
    'delete_invalid_state',
    'trash_restore_expired',
    'tag_invalid',
    'tag_limit_reached'
  ])('knows minutes.%s and translates it ahead of the generic status message', (code) => {
    const t = fakeTranslator({'errors.api.422': 'A megadott adat érvénytelen.', [`errors.code.${code}`]: `msg:${code}`});
    expect(extractMinutesErrorCode(codeError(`minutes.${code}`))).toBe(code);
    expect(translateMinutesApiError(t, codeError(`minutes.${code}`), 'errors.default')).toBe(`msg:${code}`);
  });

  it('leaves a schema-list 422 (empty / too many tags) to the generic status message', () => {
    const t = fakeTranslator({'errors.api.422': 'A megadott adat érvénytelen.'});
    const error = codeError([{loc: ['body', 'tags'], msg: 'List should have at least 1 item', type: 'too_short'}]);
    expect(translateMinutesApiError(t, error, 'errors.default')).toBe('A megadott adat érvénytelen.');
  });
});

describe('parseMinutesCode', () => {
  it('strips the prefix of a known code and rejects everything else', () => {
    expect(parseMinutesCode('minutes.witness_is_minute_taker')).toBe('witness_is_minute_taker');
    expect(parseMinutesCode(' minutes.recall_invalid_state ')).toBe('recall_invalid_state');
    expect(parseMinutesCode('witness_is_minute_taker')).toBeNull();
    expect(parseMinutesCode('minutes.nope')).toBeNull();
    expect(parseMinutesCode(null)).toBeNull();
    expect(parseMinutesCode(7)).toBeNull();
  });
});

describe('hasMissingField', () => {
  it('finds the field in a FastAPI validation list', () => {
    expect(hasMissingField(codeError([{loc: ['body', 'minute_taker_id'], msg: 'Field required'}]), 'minute_taker_id')).toBe(true);
    expect(hasMissingField(codeError([{loc: ['body', 'subject']}]), 'minute_taker_id')).toBe(false);
  });

  it('does not choke on a string detail', () => {
    expect(hasMissingField(codeError('minutes.witness_required'), 'minute_taker_id')).toBe(false);
  });
});

describe('translateMinutesErrorCode', () => {
  it('returns null for an untranslated or missing code', () => {
    const t = fakeTranslator({});
    expect(translateMinutesErrorCode(t, 'witness_required')).toBeNull();
    expect(translateMinutesErrorCode(t, null)).toBeNull();
  });
});
