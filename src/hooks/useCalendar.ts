/** Hook to access a single selected calendar model and CRUD actions. */
'use client';

import { useMemo } from 'react';
import { useCalendarSelector } from '@/src/contexts/CalendarContext';

export function useCalendar(groupId?: string, calendarId?: string) {
  const calendars = useCalendarSelector((state) => state.calendars);
  const selectedCalendarId = useCalendarSelector((state) => state.selectedCalendarId);
  const setSelectedCalendar = useCalendarSelector((state) => state.setSelectedCalendar);
  const updateCalendar = useCalendarSelector((state) => state.updateCalendar);
  const deleteCalendar = useCalendarSelector((state) => state.deleteCalendar);
  const createCalendar = useCalendarSelector((state) => state.createCalendar);

  const activeCalendarId = calendarId ?? selectedCalendarId;
  const calendar = useMemo(() => calendars.find((item) => item.id === activeCalendarId) ?? null, [activeCalendarId, calendars]);

  return {
    calendar,
    setSelectedCalendar,
    createCalendar: (name: string, description?: string | null) => createCalendar({ groupId, name, description }),
    updateCalendar: (nextName?: string | null, nextDescription?: string | null) => {
      if (!activeCalendarId) return Promise.resolve();
      return updateCalendar({ groupId, calendarId: activeCalendarId, name: nextName, description: nextDescription });
    },
    deleteCalendar: () => {
      if (!activeCalendarId) return Promise.resolve();
      return deleteCalendar({ groupId, calendarId: activeCalendarId });
    }
  };
}
