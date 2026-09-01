import {beforeEach, describe, expect, it} from 'vitest';
import {canGrantShareFlags, isForbidden, markForbidden, resetForbiddenCache} from '../filesGuard';

describe('forbidden-action cache', () => {
  beforeEach(() => resetForbiddenCache());

  it('is not forbidden until marked', () => {
    expect(isForbidden('file', 'delete', 'f1')).toBe(false);
  });

  it('remembers a marked action for that exact scope/action/id', () => {
    markForbidden('file', 'delete', 'f1');
    expect(isForbidden('file', 'delete', 'f1')).toBe(true);
    expect(isForbidden('file', 'rename', 'f1')).toBe(false);
    expect(isForbidden('folder', 'delete', 'f1')).toBe(false);
    expect(isForbidden('file', 'delete', 'f2')).toBe(false);
  });

  it('clears on reset', () => {
    markForbidden('file', 'delete', 'f1');
    resetForbiddenCache();
    expect(isForbidden('file', 'delete', 'f1')).toBe(false);
  });
});

describe('canGrantShareFlags', () => {
  it('allows granting a flag the sharer also has', () => {
    expect(canGrantShareFlags({can_view: true, can_download: true}, {can_download: true})).toBe(true);
  });

  it('rejects granting a flag the sharer does not have (no escalation)', () => {
    expect(canGrantShareFlags({can_view: true, can_download: true}, {can_edit: true})).toBe(false);
  });

  it('owners (all flags true) can grant anything', () => {
    const owner = {can_view: true, can_download: true, can_edit: true, can_delete: true, can_share: true};
    expect(canGrantShareFlags(owner, {can_edit: true, can_delete: true})).toBe(true);
  });

  it('ignores falsy/unset requested flags', () => {
    expect(canGrantShareFlags({can_view: true}, {can_view: true, can_edit: false})).toBe(true);
  });
});
