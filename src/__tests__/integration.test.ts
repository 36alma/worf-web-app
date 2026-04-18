/** Integration tests for calendar event flow and cache invalidation behavior. */
import { describe, expect, it, vi } from 'vitest';
import { createCalendarStore } from '@/src/contexts/CalendarContext';
import type { CalendarService } from '@/src/services/calendarService';

describe('calendar integration flows', () => {
  it('handles create event flow with optimistic state', async () => {
    const service = {
      createGroupCalendarEvent: vi.fn().mockResolvedValue(undefined),
      createGlobalCalendarEvent: vi.fn().mockResolvedValue(undefined),
      getGroupCalendars: vi.fn().mockResolvedValue([]),
      getGroupCalendarEvents: vi.fn().mockResolvedValue([])
    } as unknown as CalendarService;

    const store = createCalendarStore('group-1', 'token', service);
    await store.getState().createEvent({
      calendarId: 'cal-1',
      event: { kind: 'event', name: 'Kickoff', is_global: false }
    });

    expect(store.getState().pendingMutations).toBe(0);
    expect(store.getState().eventsByCalendar['cal-1']).toBeDefined();
  });

  it('invalidates event cache when deleting calendar', async () => {
    const service = {
      getGroupCalendars: vi.fn().mockResolvedValue([]),
      deleteGroupCalendar: vi.fn().mockResolvedValue(undefined)
    } as unknown as CalendarService;

    const store = createCalendarStore('group-1', 'token', service);
    store.setState({
      eventsByCalendar: {
        'cal-1': {
          events: [],
          fetchedAt: Date.now()
        }
      }
    });

    await store.getState().deleteCalendar({ calendarId: 'cal-1' });
    expect(store.getState().eventsByCalendar['cal-1']).toBeUndefined();
  });
});
