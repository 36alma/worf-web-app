import {describe, expect, it} from 'vitest';
import {sanitizeFilename} from '../formatFiles';

describe('sanitizeFilename', () => {
  it('strips accents to their base ASCII letter', () => {
    expect(sanitizeFilename('árvíztűrő tükörfúrógép.txt')).toBe('arvizturo tukorfurogep.txt');
  });

  it('replaces disallowed characters with underscore', () => {
    expect(sanitizeFilename('report:final?.pdf')).toBe('report_final_.pdf');
  });

  it('strips path traversal segments', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('.._.._etc_passwd');
  });

  it('leaves an already-valid name untouched', () => {
    expect(sanitizeFilename('Invoice (2026).pdf')).toBe('Invoice (2026).pdf');
  });
});
