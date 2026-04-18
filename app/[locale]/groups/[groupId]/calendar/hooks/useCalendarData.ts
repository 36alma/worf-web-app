'use client';

import {useEffect, useState} from 'react';
import type {
  CalendarFormValues,
  EventFormValues,
  GroupCalendarEventItem,
  GroupCalendarItem,
  SupportedLocale
} from '../types';
import {mapCalendarsPayload, mapEventsPayload, toIsoValue} from '../utils/calendarMappers';
import {worfFetch} from '../utils/worfCalendarClient';

interface UseCalendarDataOptions {
  groupId: string;
  locale: SupportedLocale;
  enabled: boolean;
  copy: {
    toasts: {
      calendarCreated: string;
      calendarUpdated: string;
      calendarDeleted: string;
      eventCreated: string;
      eventUpdated: string;
      eventDeleted: string;
    };
  };
}

interface CalendarEventPayload {
  kind: string;
  name: string;
  location: string | null;
  all_day: boolean;
  start_at: string | null;
  end_at: string | null;
  rrule: string | null;
  until_at: string | null;
  count_n: number | null;
  timezone: string | null;
  is_global: boolean;
}

/**
 * Map frontend form values to the backend event payload.
 *
 * The backend expects `kind` to be one of: SINGLE, SERIES, EXCEPTION.
 *  - SINGLE  → non-repeating event
 *  - SERIES  → repeating event (has rrule)
 *  - EXCEPTION → override of a single occurrence in a series (not used in create/edit forms)
 *
 * NOTE: Bearer token is NOT included — the proxy injects it server-side.
 */
const serializeEventForm = (values: EventFormValues): CalendarEventPayload => ({
  kind: values.repeatEnabled ? 'SERIES' : 'SINGLE',
  name: values.name.trim(),
  location: values.location.trim() || null,
  all_day: values.allDay,
  start_at: toIsoValue(values.startAt, values.allDay),
  end_at: values.endAt ? toIsoValue(values.endAt, values.allDay) : null,
  rrule: values.repeatEnabled ? `FREQ=${values.repeatFrequency}` : null,
  until_at: values.repeatEnabled && values.repeatEnds === 'until' ? toIsoValue(values.untilAt, false) : null,
  count_n:
    values.repeatEnabled && values.repeatEnds === 'count' && values.countN.trim()
      ? Number(values.countN)
      : null,
  timezone: values.timezone.trim() || null,
  is_global: false
});

const compactPayload = (value: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(value).filter(([_, entryValue]) => typeof entryValue !== 'undefined')
  );

const areValuesEqual = (left: unknown, right: unknown) => {
  if (left == null && right == null) {
    return true;
  }

  return left === right;
};

const getEventBaseline = (event: GroupCalendarEventItem): CalendarEventPayload => ({
  kind: event.rrule ? 'SERIES' : 'SINGLE',
  name: event.name,
  location: event.location,
  all_day: event.allDay,
  start_at: event.startAt,
  end_at: event.endAt,
  rrule: event.rrule,
  until_at: event.untilAt,
  count_n: event.countN,
  timezone: event.timezone,
  is_global: event.isGlobal
});

export function useCalendarData({groupId, locale, enabled, copy}: UseCalendarDataOptions) {
  const [calendars, setCalendars] = useState<GroupCalendarItem[]>([]);
  const [activeCalendarId, setActiveCalendarId] = useState('');
  const [events, setEvents] = useState<GroupCalendarEventItem[]>([]);
  const [isCalendarsLoading, setIsCalendarsLoading] = useState(false);
  const [isEventsLoading, setIsEventsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);

  const activeCalendar = calendars.find((calendar) => calendar.id === activeCalendarId) ?? null;

  const loadEvents = async (calendarId: string) => {
    if (!enabled || !calendarId) {
      setEvents([]);
      return;
    }

    setIsEventsLoading(true);

    try {
      const payload = await worfFetch({
        path: '/v1/group/calendar/event/get',
        locale,
        body: {
          group_id: groupId,
          group_calendar_id: calendarId,
          include_cancelled: false
        }
      });

      setEvents(mapEventsPayload(payload, calendarId));
    } finally {
      setIsEventsLoading(false);
    }
  };

  const loadCalendars = async (preferredCalendarId?: string) => {
    if (!enabled) {
      setCalendars([]);
      setActiveCalendarId('');
      setEvents([]);
      return;
    }

    setIsCalendarsLoading(true);

    try {
      const payload = await worfFetch({
        path: '/v1/group/calendar/get',
        locale,
        body: {
          group_id: groupId
        }
      });

      const nextCalendars = mapCalendarsPayload(payload);
      const nextActiveCalendarId =
        preferredCalendarId && nextCalendars.some((calendar) => calendar.id === preferredCalendarId)
          ? preferredCalendarId
          : nextCalendars[0]?.id ?? '';

      setCalendars(nextCalendars);
      setActiveCalendarId(nextActiveCalendarId);

      if (nextActiveCalendarId) {
        await loadEvents(nextActiveCalendarId);
      } else {
        setEvents([]);
      }
    } finally {
      setIsCalendarsLoading(false);
    }
  };

  useEffect(() => {
    if (!enabled) {
      setCalendars([]);
      setActiveCalendarId('');
      setEvents([]);
      return;
    }

    void loadCalendars();
  }, [enabled, groupId, locale]);

  const selectCalendar = async (calendarId: string) => {
    setActiveCalendarId(calendarId);
    await loadEvents(calendarId);
  };

  const createCalendar = async (values: CalendarFormValues) => {
    setIsMutating(true);

    try {
      await worfFetch({
        path: '/v1/group/calendar/create',
        locale,
        body: {
          group_id: groupId,
          calendar_name: values.calendarName.trim(),
          calendar_description: values.calendarDescription.trim() || null
        },
        successMessage: copy.toasts.calendarCreated
      });

      await loadCalendars();
    } catch {
      // Silent Policy: worfFetch already shows toast on error.
    } finally {
      setIsMutating(false);
    }
  };

  const updateCalendar = async (calendar: GroupCalendarItem, values: CalendarFormValues) => {
    const nextName = values.calendarName.trim();
    const nextDescription = values.calendarDescription.trim() || null;
    const payload = compactPayload({
      calendar_name: nextName !== calendar.name ? nextName : undefined,
      calendar_description: nextDescription !== calendar.description ? nextDescription : undefined
    });

    if (Object.keys(payload).length === 0) {
      return;
    }

    setIsMutating(true);

    try {
      await worfFetch({
        path: '/v1/group/calendar/modify',
        locale,
        body: {
          group_id: groupId,
          group_calendar_id: calendar.id,
          ...payload
        },
        successMessage: copy.toasts.calendarUpdated
      });

      await loadCalendars(calendar.id);
    } catch {
      // Silent Policy: worfFetch already shows toast on error.
    } finally {
      setIsMutating(false);
    }
  };

  const deleteCalendar = async (calendar: GroupCalendarItem) => {
    setIsMutating(true);

    try {
      await worfFetch({
        path: '/v1/group/calendar/delete',
        locale,
        body: {
          group_id: groupId,
          group_calendar_id: calendar.id
        },
        successMessage: copy.toasts.calendarDeleted
      });

      await loadCalendars();
    } catch {
      // Silent Policy: worfFetch already shows toast on error.
    } finally {
      setIsMutating(false);
    }
  };

  const createEvent = async (values: EventFormValues) => {
    if (!activeCalendarId) {
      return;
    }

    setIsMutating(true);

    try {
      await worfFetch({
        path: '/v1/group/calendar/event/create',
        locale,
        body: {
          group_id: groupId,
          group_calendar_id: activeCalendarId,
          ...serializeEventForm(values)
        },
        successMessage: copy.toasts.eventCreated
      });

      await loadEvents(activeCalendarId);
    } catch {
      // Silent Policy: worfFetch already shows toast on error.
    } finally {
      setIsMutating(false);
    }
  };

  const updateEvent = async (event: GroupCalendarEventItem, values: EventFormValues) => {
    const baseline = getEventBaseline(event);
    const nextPayload = serializeEventForm(values);
    const diff = Object.fromEntries(
      Object.entries(nextPayload).filter(([key, value]) => !areValuesEqual(value, baseline[key as keyof CalendarEventPayload]))
    );

    if (Object.keys(diff).length === 0) {
      return;
    }

    setIsMutating(true);

    try {
      await worfFetch({
        path: '/v1/group/calendar/event/modify',
        locale,
        body: {
          group_id: groupId,
          group_calendar_id: event.calendarId,
          group_calendar_event_id: event.id,
          ...diff
        },
        successMessage: copy.toasts.eventUpdated
      });

      await loadEvents(event.calendarId);
    } catch {
      // Silent Policy: worfFetch already shows toast on error.
    } finally {
      setIsMutating(false);
    }
  };

  const deleteEvent = async (event: GroupCalendarEventItem) => {
    setIsMutating(true);

    try {
      await worfFetch({
        path: '/v1/group/calendar/event/delete',
        locale,
        body: {
          group_id: groupId,
          group_calendar_id: event.calendarId,
          group_calendar_event_id: event.id
        },
        successMessage: copy.toasts.eventDeleted
      });

      setEvents((currentEvents) => currentEvents.filter((entry) => entry.id !== event.id));
    } catch {
      // Silent Policy: worfFetch already shows toast on error.
    } finally {
      setIsMutating(false);
    }
  };

  const updateEventSchedule = async (
    event: GroupCalendarEventItem,
    patch: {
      start_at: string | null;
      end_at: string | null;
      all_day: boolean;
    }
  ) => {
    const previousEvents = events;

    setEvents((currentEvents) =>
      currentEvents.map((entry) =>
        entry.id === event.id
          ? {
              ...entry,
              startAt: patch.start_at,
              endAt: patch.end_at,
              allDay: patch.all_day
            }
          : entry
      )
    );

    try {
      await worfFetch({
        path: '/v1/group/calendar/event/modify',
        locale,
        body: {
          group_id: groupId,
          group_calendar_id: event.calendarId,
          group_calendar_event_id: event.id,
          ...patch
        },
        successMessage: copy.toasts.eventUpdated
      });
    } catch (error) {
      setEvents(previousEvents);
      throw error;
    }
  };

  return {
    calendars,
    activeCalendar,
    activeCalendarId,
    events,
    isCalendarsLoading,
    isEventsLoading,
    isMutating,
    selectCalendar,
    refreshCalendars: loadCalendars,
    createCalendar,
    updateCalendar,
    deleteCalendar,
    createEvent,
    updateEvent,
    deleteEvent,
    updateEventSchedule
  };
}
