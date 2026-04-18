/** Hook to fetch and filter events for a specific calendar. */
'use client';

import { useEffect } from 'react';
import type { EventScopeFilter } from '@/src/types/calendar.types';
import { useCalendarSelector } from '@/src/contexts/CalendarContext';

interface UseEventsOptions {
  includeCancelled?: boolean;
  onlyGlobal?: boolean;
  scope?: EventScopeFilter;
}

export function useEvents(groupId: string, calendarId: string, options: UseEventsOptions = {}) {
  const loadEvents = useCalendarSelector((state) => state.loadEvents);
  const eventsState = useCalendarSelector((state) => state.eventsState);
  const getCachedEvents = useCalendarSelector((state) => state.getCachedEvents);

  useEffect(() => {
    if (!calendarId) {
      return;
    }
    void loadEvents(calendarId, {
      includeCancelled: options.includeCancelled,
      onlyGlobal: options.onlyGlobal
    });
  }, [calendarId, groupId, loadEvents, options.includeCancelled, options.onlyGlobal]);

  const events = calendarId ? getCachedEvents(calendarId, options.scope ?? 'all') : [];

  return {
    events,
    loading: eventsState.loading,
    error: eventsState.error,
    refetch: () => loadEvents(calendarId, { includeCancelled: options.includeCancelled, onlyGlobal: options.onlyGlobal })
  };
}
