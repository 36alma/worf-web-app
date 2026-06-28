import type {EventInput} from '@fullcalendar/core';
import type {
  EventDraftRange,
  EventFormValues,
  EventKind,
  GroupCalendarEventItem,
  GroupCalendarItem,
  RepeatFrequency
} from '../types';

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const toString = (value: unknown) => (value == null ? '' : String(value));

const toNullableString = (value: unknown) => {
  const next = toString(value).trim();
  return next ? next : null;
};

const toBoolean = (value: unknown) =>
  value === true ||
  value === 1 ||
  value === '1' ||
  value === 'true' ||
  value === 'TRUE' ||
  value === 'yes';

const toNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const parseJsonIfString = (value: unknown) => {
  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const readCollection = (value: unknown): Record<string, unknown>[] => {
  const queue: unknown[] = [parseJsonIfString(value)];
  const visited = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) {
      continue;
    }

    visited.add(current);

    if (Array.isArray(current)) {
      return current.map((entry) => toRecord(entry)).filter((entry) => Object.keys(entry).length > 0);
    }

    if (typeof current === 'object') {
      const record = current as Record<string, unknown>;

      for (const key of ['data', 'items', 'rows', 'result', 'events', 'calendars']) {
        if (Array.isArray(record[key])) {
          return (record[key] as unknown[])
            .map((entry) => toRecord(entry))
            .filter((entry) => Object.keys(entry).length > 0);
        }
      }

      Object.values(record).forEach((nested) => {
        queue.push(parseJsonIfString(nested));
      });
    }
  }

  return [];
};

export const normalizePermissionMap = (value: unknown): Record<string, boolean> => {
  const queue: unknown[] = [parseJsonIfString(value)];
  const visited = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current) || typeof current !== 'object') {
      continue;
    }

    visited.add(current);

    if (Array.isArray(current)) {
      current.forEach((entry) => queue.push(parseJsonIfString(entry)));
      continue;
    }

    const record = current as Record<string, unknown>;
    const entries = Object.entries(record)
      .map(([key, entryValue]) => {
        if (typeof entryValue === 'boolean') {
          return [key, entryValue] as const;
        }

        if (typeof entryValue === 'number') {
          return [key, entryValue !== 0] as const;
        }

        if (typeof entryValue === 'string') {
          const lowered = entryValue.trim().toLowerCase();
          if (lowered === 'true' || lowered === '1') {
            return [key, true] as const;
          }
          if (lowered === 'false' || lowered === '0') {
            return [key, false] as const;
          }
        }

        return null;
      })
      .filter((entry): entry is readonly [string, boolean] => entry !== null);

    if (entries.length > 0 && entries.some(([key]) => key.includes('.'))) {
      return Object.fromEntries(entries);
    }

    Object.values(record).forEach((entry) => queue.push(parseJsonIfString(entry)));
  }

  return {};
};

const normalizeEventKind = (value: unknown): EventKind => {
  const next = toString(value).trim().toLowerCase();
  if (next === 'task' || next === 'reminder' || next === 'birthday') {
    return next;
  }

  return 'event';
};

export const mapCalendarsPayload = (value: unknown): GroupCalendarItem[] =>
  readCollection(value)
    .map((entry) => {
      const id = toString(entry.group_calendar_id ?? entry.calendar_id ?? entry.id).trim();
      if (!id) {
        return null;
      }

      return {
        id,
        name: toString(entry.calendar_name ?? entry.name).trim() || 'Calendar',
        description: toNullableString(entry.calendar_description ?? entry.description),
        raw: entry
      } satisfies GroupCalendarItem;
    })
    .filter((entry): entry is GroupCalendarItem => entry !== null);

export const mapEventsPayload = (value: unknown, activeCalendarId: string): GroupCalendarEventItem[] =>
  readCollection(value)
    .map((entry) => {
      const id = toString(entry.group_calendar_event_id ?? entry.calendar_event_id ?? entry.event_id ?? entry.id).trim();
      if (!id) {
        return null;
      }

      return {
        id,
        calendarId:
          toString(entry.group_calendar_id ?? entry.calendar_id ?? activeCalendarId).trim() ||
          activeCalendarId,
        name: toString(entry.name ?? entry.title).trim() || 'Untitled event',
        kind: normalizeEventKind(entry.kind),
        location: toNullableString(entry.location),
        allDay: toBoolean(entry.all_day),
        startAt: toNullableString(entry.start_at),
        endAt: toNullableString(entry.end_at),
        timezone: toNullableString(entry.timezone),
        rrule: toNullableString(entry.rrule),
        untilAt: toNullableString(entry.until_at),
        countN: toNumber(entry.count_n),
        isGlobal: toBoolean(entry.is_global),
        isCancelled: toBoolean(entry.is_cancelled),
        raw: entry
      } satisfies GroupCalendarEventItem;
    })
    .filter((entry): entry is GroupCalendarEventItem => entry !== null);

const eventPalette: Record<EventKind, {backgroundColor: string; borderColor: string; textColor: string}> = {
  event: {
    backgroundColor: '#2563eb',
    borderColor: '#3b82f6',
    textColor: '#ffffff'
  },
  task: {
    backgroundColor: '#15803d',
    borderColor: '#22c55e',
    textColor: '#ffffff'
  },
  reminder: {
    backgroundColor: '#c2410c',
    borderColor: '#f97316',
    textColor: '#ffffff'
  },
  birthday: {
    backgroundColor: '#be185d',
    borderColor: '#ec4899',
    textColor: '#ffffff'
  }
};

export const toFullCalendarEvent = (event: GroupCalendarEventItem): EventInput => {
  const palette = eventPalette[event.kind];

  return {
    id: event.id,
    title: event.name,
    start: event.startAt ?? undefined,
    end: event.endAt ?? undefined,
    allDay: event.allDay,
    backgroundColor: palette.backgroundColor,
    borderColor: palette.borderColor,
    textColor: palette.textColor,
    classNames: event.isCancelled ? ['fc-event-cancelled'] : [],
    extendedProps: {
      source: event
    }
  };
};

export const detectRepeatFrequency = (rrule: string | null): RepeatFrequency => {
  const normalized = (rrule ?? '').toUpperCase();
  if (normalized.includes('FREQ=DAILY')) return 'DAILY';
  if (normalized.includes('FREQ=MONTHLY')) return 'MONTHLY';
  if (normalized.includes('FREQ=YEARLY')) return 'YEARLY';
  return 'WEEKLY';
};

export const toInputValue = (iso: string | null, allDay: boolean) => {
  if (!iso) {
    return '';
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  if (allDay) {
    return date.toISOString().slice(0, 10);
  }

  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

export const toIsoValue = (value: string, allDay: boolean) => {
  if (!value.trim()) {
    return null;
  }

  const next = allDay ? new Date(`${value}T00:00:00`) : new Date(value);
  if (Number.isNaN(next.getTime())) {
    return null;
  }

  return next.toISOString();
};

export const getInitialEventFormValues = (
  event: GroupCalendarEventItem | null,
  range: EventDraftRange | null,
  fallbackTimezone: string
): EventFormValues => {
  if (event) {
    const repeatEnabled = Boolean(event.rrule);

    return {
      name: event.name,
      kind: event.kind,
      allDay: event.allDay,
      startAt: toInputValue(event.startAt, event.allDay),
      endAt: toInputValue(event.endAt, event.allDay),
      location: event.location ?? '',
      timezone: event.timezone ?? fallbackTimezone,
      repeatEnabled,
      repeatFrequency: detectRepeatFrequency(event.rrule),
      repeatEnds: event.countN ? 'count' : 'until',
      untilAt: toInputValue(event.untilAt, false),
      countN: event.countN != null ? String(event.countN) : ''
    };
  }

  const initialStart = range?.startAt ? new Date(range.startAt) : new Date();
  const initialEnd = range?.endAt ? new Date(range.endAt) : new Date(initialStart.getTime() + 60 * 60 * 1000);
  const allDay = range?.allDay ?? false;

  return {
    name: '',
    kind: 'event',
    allDay,
    startAt: toInputValue(initialStart.toISOString(), allDay),
    endAt: range?.endAt ? toInputValue(initialEnd.toISOString(), allDay) : '',
    location: '',
    timezone: fallbackTimezone,
    repeatEnabled: false,
    repeatFrequency: 'WEEKLY',
    repeatEnds: 'until',
    untilAt: '',
    countN: ''
  };
};

export const formatEventDate = (value: string | null, locale: string, timezone?: string | null) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone ?? undefined
  }).format(date);
};
