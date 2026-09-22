import {describe, expect, it} from 'vitest';
import {activityKey, activityTypes} from '../dashboardActivity';
import {describeElapsed} from '../dashboardDates';

describe('activityTypes', () => {
  it('asks for everything with null, and for one entity otherwise', () => {
    expect(activityTypes('all')).toBeNull();
    expect(activityTypes('task')).toEqual(['task']);
    expect(activityTypes('minutes')).toEqual(['minutes']);
  });
});

describe('activityKey', () => {
  it('is the timestamp plus position, so rows sharing a timestamp stay distinct', () => {
    expect(activityKey({occurred_at: '2026-09-20T09:12:00Z'}, 0)).not.toBe(activityKey({occurred_at: '2026-09-20T09:12:00Z'}, 1));
  });
});

describe('describeElapsed', () => {
  const now = new Date('2026-09-20T12:00:00Z');
  const ago = (ms: number) => new Date(now.getTime() - ms);

  it('picks the coarsest whole unit', () => {
    expect(describeElapsed(ago(30_000), now)).toEqual({value: 30, unit: 'second'});
    expect(describeElapsed(ago(5 * 60_000), now)).toEqual({value: 5, unit: 'minute'});
    expect(describeElapsed(ago(3 * 3_600_000), now)).toEqual({value: 3, unit: 'hour'});
    expect(describeElapsed(ago(2 * 86_400_000), now)).toEqual({value: 2, unit: 'day'});
  });

  it('rounds down at the unit boundaries', () => {
    expect(describeElapsed(ago(59_999), now)).toEqual({value: 59, unit: 'second'});
    expect(describeElapsed(ago(60_000), now)).toEqual({value: 1, unit: 'minute'});
    expect(describeElapsed(ago(3_600_000), now)).toEqual({value: 1, unit: 'hour'});
    expect(describeElapsed(ago(86_400_000), now)).toEqual({value: 1, unit: 'day'});
  });

  it('gives up after a week, when a date reads better', () => {
    expect(describeElapsed(ago(6 * 86_400_000 + 3_600_000), now)?.unit).toBe('day');
    expect(describeElapsed(ago(7 * 86_400_000), now)).toBeNull();
  });

  it('never reports the future — a fast clock reads as "just now"', () => {
    expect(describeElapsed(new Date(now.getTime() + 5_000), now)).toEqual({value: 0, unit: 'second'});
  });

  it('is null for an invalid date', () => {
    expect(describeElapsed(new Date('nonsense'), now)).toBeNull();
  });
});
