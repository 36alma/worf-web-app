/** Hook to delete events with optimistic update and rollback support. */
'use client';

import { useCalendarSelector } from '@/src/contexts/CalendarContext';

export function useDeleteEvent() {
  const deleteEvent = useCalendarSelector((state) => state.deleteEvent);
  return deleteEvent;
}
