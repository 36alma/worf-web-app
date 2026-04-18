/** UI-level types for calendar state and async statuses. */
import type { GroupCalendar, GroupCalendarEvent } from '@/src/types/calendar.types';

export interface AsyncState<T> {
  loading: boolean;
  error: string | null;
  data: T;
}

export interface CalendarCacheEntry {
  events: GroupCalendarEvent[];
  fetchedAt: number | null;
}

export interface CalendarState {
  groupId: string;
  selectedCalendarId: string | null;
  calendars: GroupCalendar[];
  eventsByCalendar: Record<string, CalendarCacheEntry>;
  calendarsState: AsyncState<GroupCalendar[]>;
  eventsState: AsyncState<GroupCalendarEvent[]>;
  pendingMutations: number;
}
