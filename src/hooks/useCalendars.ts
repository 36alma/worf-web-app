/** Hook to fetch and manage calendars for a group. */
'use client';

import { useEffect } from 'react';
import { useCalendarSelector } from '@/src/contexts/CalendarContext';

export function useCalendars(groupId?: string) {
  const calendars = useCalendarSelector((state) => state.calendars);
  const selectedCalendarId = useCalendarSelector((state) => state.selectedCalendarId);
  const calendarsState = useCalendarSelector((state) => state.calendarsState);
  const loadCalendars = useCalendarSelector((state) => state.loadCalendars);
  const setSelectedCalendar = useCalendarSelector((state) => state.setSelectedCalendar);

  useEffect(() => {
    void loadCalendars(groupId);
  }, [groupId, loadCalendars]);

  return {
    calendars,
    selectedCalendarId,
    loading: calendarsState.loading,
    error: calendarsState.error,
    setSelectedCalendar,
    refetch: () => loadCalendars(groupId)
  };
}
