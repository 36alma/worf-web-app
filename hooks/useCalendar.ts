'use client';

import {useCallback, useEffect, useMemo, useState} from 'react';
import {
  createGlobalCalendarEvent,
  createGroupCalendar,
  createGroupCalendarEvent,
  deleteGlobalCalendarEvent,
  deleteGroupCalendar,
  deleteGroupCalendarEvent,
  getGroupCalendarEvents,
  getGroupCalendars,
  modifyGlobalCalendarEvent,
  modifyGroupCalendar,
  modifyGroupCalendarEvent
} from '@/lib/api/calendar';
import {getUserGroups} from '@/lib/api/groups';
import type {
  CalendarScope,
  EventMutationFields,
  GroupCalendar,
  GroupCalendarEvent,
  GroupOption
} from '@/lib/types/calendar';

type RawObject = Record<string, unknown>;

const toRecord = (value: unknown): RawObject => (value && typeof value === 'object' ? (value as RawObject) : {});

const readData = (payload: unknown): unknown => {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  const candidate = payload as RawObject;
  if ('data' in candidate) {
    return candidate.data;
  }

  return payload;
};

const readArray = (payload: unknown): unknown[] => {
  const source = readData(payload);
  if (Array.isArray(source)) {
    return source;
  }

  if (!source || typeof source !== 'object') {
    return [];
  }

  const objectSource = source as RawObject;
  const nested = ['items', 'rows', 'result', 'events', 'calendars', 'groups']
    .map((key) => objectSource[key])
    .find((value) => Array.isArray(value));

  return Array.isArray(nested) ? nested : [];
};

const readString = (value: unknown): string => (value == null ? '' : String(value));

const readBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return ['true', '1', 'yes'].includes(value.toLowerCase());
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  return false;
};

const readNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
};

const mapGroups = (payload: unknown): GroupOption[] =>
  readArray(payload)
    .map((item) => {
      const row = toRecord(item);
      const id = readString(row.group_id ?? row.id);
      if (!id) {
        return null;
      }

      return {
        id,
        name: readString(row.group_name ?? row.name ?? row.title ?? id)
      };
    })
    .filter((row): row is GroupOption => Boolean(row));

const mapCalendars = (payload: unknown, groupId: string): GroupCalendar[] => {
  const result: GroupCalendar[] = [];
  for (const item of readArray(payload)) {
    const row = toRecord(item);
    const id = readString(row.group_calendar_id ?? row.calendar_id ?? row.id);
    if (!id) {
      continue;
    }

    result.push({
      id,
      groupId: readString(row.group_id ?? groupId),
      name: readString(row.calendar_name ?? row.name ?? id),
      description: readString(row.calendar_description ?? row.description) || undefined,
      raw: row
    });
  }

  return result;
};

const mapEvents = (payload: unknown, groupId: string, groupCalendarId: string): GroupCalendarEvent[] => {
  const result: GroupCalendarEvent[] = [];
  for (const item of readArray(payload)) {
    const row = toRecord(item);
    const id = readString(row.group_calendar_event_id ?? row.event_id ?? row.id);
    if (!id) {
      continue;
    }

    result.push({
      id,
      groupId: readString(row.group_id ?? groupId),
      groupCalendarId: readString(row.group_calendar_id ?? row.calendar_id ?? groupCalendarId),
      name: readString(row.name ?? row.title ?? id),
      kind: readString(row.kind ?? 'event'),
      parentId: readString(row.parent_id) || undefined,
      location: readString(row.location) || undefined,
      allDay: readBoolean(row.all_day),
      startAt: readString(row.start_at) || undefined,
      endAt: readString(row.end_at) || undefined,
      rrule: readString(row.rrule) || undefined,
      untilAt: readString(row.until_at) || undefined,
      countN: readNumber(row.count_n),
      originalStartAt: readString(row.original_start_at) || undefined,
      isCancelled: readBoolean(row.is_cancelled),
      timezone: readString(row.timezone) || undefined,
      isGlobal: readBoolean(row.is_global),
      raw: row
    });
  }

  return result;
};

interface UseCalendarArgs {
  initialGroupId?: string;
}

interface EventMutationInput {
  scope: CalendarScope;
  eventId?: string;
  data: EventMutationFields & {
    kind: string;
    name: string;
  };
}

export function useCalendar({initialGroupId}: UseCalendarArgs = {}) {
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [groupId, setGroupId] = useState(initialGroupId ?? '');
  const [calendars, setCalendars] = useState<GroupCalendar[]>([]);
  const [calendarId, setCalendarId] = useState('');
  const [events, setEvents] = useState<GroupCalendarEvent[]>([]);
  const [includeCancelled, setIncludeCancelled] = useState(false);
  const [scopeFilter, setScopeFilter] = useState<'all' | 'group' | 'global'>('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const safeError = useCallback((reason: unknown) => {
    if (!reason || typeof reason !== 'object') {
      return 'Calendar request failed';
    }

    const candidate = reason as {
      message?: string;
      response?: {
        data?: {
          message?: string;
          error?: string;
        };
      };
    };

    const backendMessage = candidate.response?.data?.message ?? candidate.response?.data?.error;
    if (backendMessage) {
      return backendMessage;
    }

    if (candidate.message) {
      return candidate.message;
    }

    return 'Calendar request failed';
  }, []);

  const loadGroups = useCallback(async (): Promise<GroupOption[]> => {
    try {
      const response = await getUserGroups();
      const rows = mapGroups(response.data);
      setGroups(rows);

      if (!groupId && rows.length > 0) {
        setGroupId(initialGroupId ?? rows[0].id);
      }

      return rows;
    } catch {
      // Group list is optional for fixed group pages.
      return [];
    }
  }, [groupId, initialGroupId]);

  const loadCalendars = useCallback(async (): Promise<{rows: GroupCalendar[]; selectedId: string}> => {
    if (!groupId) {
      setCalendars([]);
      setCalendarId('');
      return {rows: [], selectedId: ''};
    }

    const response = await getGroupCalendars({group_id: groupId});
    const rows = mapCalendars(response.data, groupId);
    setCalendars(rows);

    const selectedId = rows.some((row) => row.id === calendarId) ? calendarId : (rows[0]?.id ?? '');
    if (selectedId !== calendarId) {
      setCalendarId(selectedId);
    }

    return {rows, selectedId};
  }, [calendarId, groupId]);

  const loadEvents = useCallback(async (targetCalendarId?: string) => {
    const activeCalendarId = targetCalendarId ?? calendarId;
    if (!groupId || !activeCalendarId) {
      setEvents([]);
      return;
    }

    const response = await getGroupCalendarEvents({
      group_id: groupId,
      group_calendar_id: activeCalendarId,
      include_cancelled: includeCancelled || undefined,
      only_global: scopeFilter === 'global' ? true : undefined
    });

    let rows = mapEvents(response.data, groupId, activeCalendarId);
    if (scopeFilter === 'group') {
      rows = rows.filter((row) => !row.isGlobal);
    }

    setEvents(rows);
  }, [calendarId, groupId, includeCancelled, scopeFilter]);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await loadGroups();
      const {selectedId} = await loadCalendars();
      if (selectedId) {
        await loadEvents(selectedId);
      } else {
        setEvents([]);
      }
    } catch (reason) {
      setError(safeError(reason));
    } finally {
      setLoading(false);
    }
  }, [loadCalendars, loadEvents, loadGroups, safeError]);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    setCalendarId('');
  }, [groupId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!groupId || !calendarId) {
        setEvents([]);
        return;
      }

      try {
        await loadEvents();
      } catch (reason) {
        if (!cancelled) {
          setError(safeError(reason));
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [calendarId, groupId, includeCancelled, loadEvents, safeError, scopeFilter]);

  const createCalendarItem = useCallback(
    async (name: string, description?: string) => {
      if (!groupId) {
        throw new Error('group_id is required');
      }

      setSaving(true);
      try {
        await createGroupCalendar({
          group_id: groupId,
          calendar_name: name,
          calendar_description: description || undefined
        });
        await refetch();
      } finally {
        setSaving(false);
      }
    },
    [groupId, refetch]
  );

  const updateCalendarItem = useCallback(
    async (targetCalendarId: string, name?: string, description?: string) => {
      if (!groupId) {
        throw new Error('group_id is required');
      }

      setSaving(true);
      try {
        await modifyGroupCalendar({
          group_id: groupId,
          group_calendar_id: targetCalendarId,
          calendar_name: name || undefined,
          calendar_description: description || undefined
        });
        await refetch();
      } finally {
        setSaving(false);
      }
    },
    [groupId, refetch]
  );

  const deleteCalendarItem = useCallback(
    async (targetCalendarId: string) => {
      if (!groupId) {
        throw new Error('group_id is required');
      }

      setSaving(true);
      try {
        await deleteGroupCalendar({
          group_id: groupId,
          group_calendar_id: targetCalendarId
        });
        await refetch();
      } finally {
        setSaving(false);
      }
    },
    [groupId, refetch]
  );

  const upsertEvent = useCallback(
    async ({scope, eventId, data}: EventMutationInput) => {
      if (!groupId || !calendarId) {
        throw new Error('group_id and group_calendar_id are required');
      }

      setSaving(true);
      try {
        if (eventId) {
          if (scope === 'global') {
            await modifyGlobalCalendarEvent({
              group_id: groupId,
              group_calendar_id: calendarId,
              group_calendar_event_id: eventId,
              ...data
            });
          } else {
            await modifyGroupCalendarEvent({
              group_id: groupId,
              group_calendar_id: calendarId,
              group_calendar_event_id: eventId,
              ...data
            });
          }
        } else if (scope === 'global') {
          await createGlobalCalendarEvent({
            group_id: groupId,
            group_calendar_id: calendarId,
            ...data
          });
        } else {
          await createGroupCalendarEvent({
            group_id: groupId,
            group_calendar_id: calendarId,
            ...data
          });
        }

        await loadEvents();
      } finally {
        setSaving(false);
      }
    },
    [calendarId, groupId, loadEvents]
  );

  const deleteEvent = useCallback(
    async (event: GroupCalendarEvent) => {
      if (!groupId || !calendarId) {
        throw new Error('group_id and group_calendar_id are required');
      }

      setSaving(true);
      try {
        if (event.isGlobal) {
          await deleteGlobalCalendarEvent({group_calendar_event_id: event.id});
        } else {
          await deleteGroupCalendarEvent({
            group_id: groupId,
            group_calendar_id: calendarId,
            group_calendar_event_id: event.id
          });
        }

        await loadEvents();
      } finally {
        setSaving(false);
      }
    },
    [calendarId, groupId, loadEvents]
  );

  const moveEvent = useCallback(
    async (event: GroupCalendarEvent, startAt: string, endAt: string) => {
      await upsertEvent({
        scope: event.isGlobal ? 'global' : 'group',
        eventId: event.id,
        data: {
          kind: event.kind,
          name: event.name,
          start_at: startAt,
          end_at: endAt,
          all_day: event.allDay
        }
      });
    },
    [upsertEvent]
  );

  const selectedCalendar = useMemo(
    () => calendars.find((calendar) => calendar.id === calendarId) ?? null,
    [calendarId, calendars]
  );

  return {
    groups,
    groupId,
    setGroupId,
    calendars,
    calendarId,
    setCalendarId,
    selectedCalendar,
    events,
    includeCancelled,
    setIncludeCancelled,
    scopeFilter,
    setScopeFilter,
    loading,
    saving,
    error,
    refetch,
    createCalendar: createCalendarItem,
    updateCalendar: updateCalendarItem,
    deleteCalendar: deleteCalendarItem,
    upsertEvent,
    deleteEvent,
    moveEvent
  };
}
