import {describe, expect, it} from 'vitest';
import type {UpcomingEvent} from '@/lib/types/dashboard';
import {
  isOngoing,
  normalizeUpcomingEvent,
  toEventRecordItem,
  toOccurrenceItem,
  upcomingEventKey
} from '../dashboardEvents';

const series = (over: Partial<UpcomingEvent> = {}): UpcomingEvent => ({
  group_calendar_event_id: '11111111-1111-1111-1111-111111111111',
  group_calendar_id: 'enc-cal',
  kind: 'SERIES',
  name: 'Heti DÖK-gyűlés',
  parent_id: null,
  location: 'Aula',
  all_day: false,
  start_at: '2026-06-01T18:00:00',
  end_at: '2026-06-01T19:00:00',
  rrule: 'FREQ=WEEKLY;BYDAY=MO',
  until_at: null,
  count_n: null,
  original_start_at: null,
  is_cancelled: false,
  is_global: false,
  timezone: 'Europe/Budapest',
  group_id: 'abc=',
  group_name: 'Diákönkormányzat',
  calendar_name: 'DÖK naptár',
  occurrence_start_at: '2026-09-21T16:00:00Z',
  occurrence_end_at: '2026-09-21T17:00:00Z',
  ...over
});

describe('toOccurrenceItem', () => {
  it("shows the occurrence's own times, not the series' first start", () => {
    const item = toOccurrenceItem(series());
    expect(item?.startAt).toBe('2026-09-21T16:00:00Z');
    expect(item?.endAt).toBe('2026-09-21T17:00:00Z');
  });

  it('carries what the modals need', () => {
    const item = toOccurrenceItem(series());
    expect(item).toMatchObject({
      id: '11111111-1111-1111-1111-111111111111',
      calendarId: 'enc-cal',
      name: 'Heti DÖK-gyűlés',
      location: 'Aula',
      timezone: 'Europe/Budapest',
      rrule: 'FREQ=WEEKLY;BYDAY=MO',
      allDay: false,
      isCancelled: false
    });
  });
});

describe('toEventRecordItem', () => {
  it('keeps the stored start of the series, so an edit diffs against the real record', () => {
    const item = toEventRecordItem(series());
    expect(item?.startAt).toBe('2026-06-01T18:00:00');
    expect(item?.endAt).toBe('2026-06-01T19:00:00');
    expect(item?.rrule).toBe('FREQ=WEEKLY;BYDAY=MO');
  });

  it('ids match the occurrence item, so delete/update address the same record', () => {
    const event = series();
    expect(toEventRecordItem(event)?.id).toBe(toOccurrenceItem(event)?.id);
    expect(toEventRecordItem(event)?.calendarId).toBe(toOccurrenceItem(event)?.calendarId);
  });
});

describe('upcomingEventKey', () => {
  it('tells the repeats of one series apart', () => {
    expect(upcomingEventKey(series())).not.toBe(
      upcomingEventKey(series({occurrence_start_at: '2026-09-28T16:00:00Z'}))
    );
  });

  it('is stable across refetches (the plain event id, not an encrypted one)', () => {
    expect(upcomingEventKey(series({group_calendar_id: 'a', group_id: 'x'}))).toBe(
      upcomingEventKey(series({group_calendar_id: 'b', group_id: 'y'}))
    );
  });
});

describe('isOngoing', () => {
  const event = series();

  it('is true between start (inclusive) and end (exclusive)', () => {
    expect(isOngoing(event, new Date('2026-09-21T16:00:00Z'))).toBe(true);
    expect(isOngoing(event, new Date('2026-09-21T16:59:59Z'))).toBe(true);
    expect(isOngoing(event, new Date('2026-09-21T17:00:00Z'))).toBe(false);
  });

  it('is false before it starts', () => {
    expect(isOngoing(event, new Date('2026-09-21T15:59:59Z'))).toBe(false);
  });
});

describe('normalizeUpcomingEvent', () => {
  it('decodes a percent-encoded group id', () => {
    expect(normalizeUpcomingEvent(series({group_id: 'abc%3D'})).group_id).toBe('abc=');
  });
});
