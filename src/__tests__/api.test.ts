/** Unit tests for calendar service and date utility helpers. */
import { describe, expect, it, vi } from 'vitest';
import { CalendarService } from '@/src/services/calendarService';
import { groupEventsByDate, validateEventDates } from '@/src/utils/dateUtils';
import type { CalendarApi } from '@/src/api/calendarApi';

describe('dateUtils', () => {
  it('validates chronological dates', () => {
    expect(validateEventDates('2026-04-07T10:00:00Z', '2026-04-07T11:00:00Z')).toBe(true);
    expect(validateEventDates('2026-04-07T11:00:00Z', '2026-04-07T10:00:00Z')).toBe(false);
  });

  it('groups events by YYYY-MM-DD', () => {
    const grouped = groupEventsByDate([
      {
        id: '1',
        groupId: 'g1',
        calendarId: 'c1',
        kind: 'event',
        name: 'A',
        parentId: null,
        location: null,
        allDay: false,
        startAt: '2026-04-07T09:00:00Z',
        endAt: null,
        rrule: null,
        untilAt: null,
        countN: null,
        originalStartAt: null,
        isCancelled: false,
        timezone: null,
        isGlobal: false,
        raw: {}
      }
    ]);
    expect(grouped.get('2026-04-07')?.length).toBe(1);
  });
});

describe('CalendarService', () => {
  it('maps calendar list response', async () => {
    const api = {
      getGroupCalendar: vi.fn().mockResolvedValue({
        data: [{ group_calendar_id: 'c1', group_id: 'g1', calendar_name: 'Main' }]
      })
    } as unknown as CalendarApi;
    const service = new CalendarService(api, vi.fn());

    const result = await service.getGroupCalendars({ Bearer: 'x', group_id: 'g1' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('c1');
    expect(result[0].name).toBe('Main');
  });
});
