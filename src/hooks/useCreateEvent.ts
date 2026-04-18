/** Hook to create calendar events with optimistic update flow. */
'use client';

import { useCalendarSelector } from '@/src/contexts/CalendarContext';

export function useCreateEvent() {
  const createEvent = useCalendarSelector((state) => state.createEvent);
  return createEvent;
}
