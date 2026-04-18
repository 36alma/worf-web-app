/** Hook to modify calendar events with optimistic cache update. */
'use client';

import { useCalendarSelector } from '@/src/contexts/CalendarContext';

export function useUpdateEvent() {
  const updateEvent = useCalendarSelector((state) => state.updateEvent);
  return updateEvent;
}
