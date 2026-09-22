import type {GroupCalendarEventItem} from '@/app/[locale]/groups/[groupId]/calendar/types';
import {mapEventsPayload} from '@/app/[locale]/groups/[groupId]/calendar/utils/calendarMappers';
import type {UpcomingEvent} from '@/lib/types/dashboard';
import {normalizeGroupId} from './groupId';

/** `group_id` into its raw form, like every other group id in the app. */
export const normalizeUpcomingEvent = (event: UpcomingEvent): UpcomingEvent => ({
  ...event,
  group_id: normalizeGroupId(event.group_id)
});

/**
 * An occurrence's identity: the event id is a plain UUID (unlike the encrypted ids), the occurrence start tells the
 * repeats of a series apart.
 */
export const upcomingEventKey = (event: Pick<UpcomingEvent, 'group_calendar_event_id' | 'occurrence_start_at'>): string =>
  `${event.group_calendar_event_id}|${event.occurrence_start_at}`;

/** Started, not yet over — in the occurrence's own (UTC) instants. */
export function isOngoing(event: Pick<UpcomingEvent, 'occurrence_start_at' | 'occurrence_end_at'>, now: Date): boolean {
  const start = new Date(event.occurrence_start_at).getTime();
  const end = new Date(event.occurrence_end_at).getTime();
  return !Number.isNaN(start) && !Number.isNaN(end) && start <= now.getTime() && now.getTime() < end;
}

/**
 * The occurrence as the calendar's `EventViewModal` shows it: its own start and end (UTC instants), not the
 * series' first start — "every Monday" would otherwise display June's date.
 */
export const toOccurrenceItem = (event: UpcomingEvent): GroupCalendarEventItem | null =>
  mapEventsPayload([{...event, start_at: event.occurrence_start_at, end_at: event.occurrence_end_at}], event.group_calendar_id)[0] ??
  null;

/**
 * The stored event record — a series keeps its first start. This is what the edit form loads and what
 * `updateEvent` diffs against, so editing from the dashboard behaves exactly like editing on the calendar page.
 */
export const toEventRecordItem = (event: UpcomingEvent): GroupCalendarEventItem | null =>
  mapEventsPayload([event], event.group_calendar_id)[0] ?? null;
