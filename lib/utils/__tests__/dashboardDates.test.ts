import {describe, expect, it} from 'vitest';
import {dayBucket, describeDay} from '../dashboardDates';

// Local-time constructors on purpose: "today" is a local calendar day, so the tests must not depend on the machine's zone.
const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min);

describe('dayBucket', () => {
  const now = at(2026, 9, 21, 10, 30);

  it('same local day is today, even earlier or later in the day', () => {
    expect(dayBucket(at(2026, 9, 21, 0, 5), now)).toBe('today');
    expect(dayBucket(at(2026, 9, 21, 23, 59), now)).toBe('today');
  });

  it('the next local day is tomorrow, including just after midnight', () => {
    expect(dayBucket(at(2026, 9, 22, 0, 1), now)).toBe('tomorrow');
    expect(dayBucket(at(2026, 9, 22, 18, 0), now)).toBe('tomorrow');
  });

  it('anything else is other', () => {
    expect(dayBucket(at(2026, 9, 23, 9, 0), now)).toBe('other');
    expect(dayBucket(at(2026, 9, 20, 9, 0), now)).toBe('other');
  });

  it('crosses month and year boundaries', () => {
    expect(dayBucket(at(2027, 1, 1, 8, 0), at(2026, 12, 31, 20, 0))).toBe('tomorrow');
  });

  it('holds across the autumn DST change (25-hour day)', () => {
    // Europe switches on the last Sunday of October; the bucket is by calendar day, not by 24h blocks.
    expect(dayBucket(at(2026, 10, 26, 0, 30), at(2026, 10, 25, 0, 30))).toBe('tomorrow');
  });
});

describe('describeDay', () => {
  it('returns null for an invalid timestamp', () => {
    expect(describeDay('not-a-date', new Date(), 'hu')).toBeNull();
  });

  it('carries the bucket and formatted pieces', () => {
    const now = at(2026, 9, 21, 10, 0);
    const target = at(2026, 9, 21, 14, 0);
    const label = describeDay(target.toISOString(), now, 'hu');
    expect(label?.bucket).toBe('today');
    expect(label?.time).toBe('14:00');
    expect(label?.day).toBeTruthy();
  });
});
