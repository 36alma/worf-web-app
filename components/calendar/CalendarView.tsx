'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useUiStore } from '@/lib/store/uiStore';
import { useAuthStore } from '@/lib/store/authStore';
import {
  postGroupCalendarEventCreate,
  postGroupCalendarEventDelete,
  postGroupCalendarEventGet,
  postGroupCalendarEventModify,
  postGroupCalendarGet,
} from '@/lib/api/worfCalendar';

type CalendarRow = {
  id: string;
  name: string;
};

type EventRow = {
  id: string;
  groupCalendarId: string;
  kind: string;
  name: string;
  location: string;
  allDay: boolean;
  startAt: string;
  endAt: string;
  timezone: string;
  countN: string;
  untilAt: string;
  originalStartAt: string;
  rrule: string;
  parentId: string;
  isCancelled: boolean;
  isGlobal: boolean;
};

type EventFormState = {
  kind: string;
  name: string;
  location: string;
  all_day: boolean;
  start_at: string;
  end_at: string;
  timezone: string;
  count_n: string;
  until_at: string;
  original_start_at: string;
  rrule: string;
  parent_id: string;
  is_cancelled: boolean;
  is_global: boolean;
};

interface CalendarViewProps {
  initialGroupId?: string;
}

const initialFormState: EventFormState = {
  kind: 'event',
  name: '',
  location: '',
  all_day: false,
  start_at: '',
  end_at: '',
  timezone: 'Europe/Budapest',
  count_n: '',
  until_at: '',
  original_start_at: '',
  rrule: '',
  parent_id: '',
  is_cancelled: false,
  is_global: false,
};

const localStorageTokenKeys = ['worf_access_token', 'access_token', 'token'];

function readArray(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) {
    return payload as Array<Record<string, unknown>>;
  }

  if (payload && typeof payload === 'object') {
    const directData = (payload as { data?: unknown }).data;
    if (Array.isArray(directData)) {
      return directData as Array<Record<string, unknown>>;
    }

    if (directData && typeof directData === 'object') {
      const nestedRows = (directData as { data?: unknown }).data;
      if (Array.isArray(nestedRows)) {
        return nestedRows as Array<Record<string, unknown>>;
      }
    }
  }

  return [];
}

function toStr(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function toBool(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  return false;
}

function toLocalDateTimeInput(iso: string): string {
  if (!iso) {
    return '';
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const tzOffsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffsetMs).toISOString().slice(0, 16);
}

function fromLocalDateTimeInput(value: string): string | undefined {
  if (!value.trim()) {
    return undefined;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString();
}

function compactPayload<T extends Record<string, unknown>>(payload: T): T {
  const entries = Object.entries(payload).filter(([_, value]) => {
    if (typeof value === 'undefined') {
      return false;
    }

    if (typeof value === 'string') {
      return value.trim().length > 0;
    }

    return true;
  });

  return Object.fromEntries(entries) as T;
}

function toEventFormState(event: EventRow): EventFormState {
  return {
    kind: event.kind || 'event',
    name: event.name,
    location: event.location,
    all_day: event.allDay,
    start_at: toLocalDateTimeInput(event.startAt),
    end_at: toLocalDateTimeInput(event.endAt),
    timezone: event.timezone || 'Europe/Budapest',
    count_n: event.countN,
    until_at: toLocalDateTimeInput(event.untilAt),
    original_start_at: toLocalDateTimeInput(event.originalStartAt),
    rrule: event.rrule,
    parent_id: event.parentId,
    is_cancelled: event.isCancelled,
    is_global: event.isGlobal,
  };
}

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const message =
      (error.response?.data as { message?: string } | undefined)?.message ||
      (error.response?.data as { error?: string } | undefined)?.error ||
      error.message;

    if (status && status >= 400) {
      return `API ${status}: ${message}`;
    }

    return message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unexpected error';
}

export default function CalendarView({ initialGroupId }: CalendarViewProps) {
  const selectedGroupId = useUiStore((state) => state.selectedGroupId);
  const user = useAuthStore((state) => state.user);

  const [groupId, setGroupId] = useState(initialGroupId ?? selectedGroupId ?? '');
  const [groupIdInput, setGroupIdInput] = useState(initialGroupId ?? selectedGroupId ?? '');

  const [calendars, setCalendars] = useState<CalendarRow[]>([]);
  const [calendarId, setCalendarId] = useState('');
  const [events, setEvents] = useState<EventRow[]>([]);
  const [includeCancelled, setIncludeCancelled] = useState(false);

  const [isLoadingCalendars, setIsLoadingCalendars] = useState(false);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [editingEventId, setEditingEventId] = useState('');
  const [eventForm, setEventForm] = useState<EventFormState>(initialFormState);

  useEffect(() => {
    if (initialGroupId) {
      setGroupId(initialGroupId);
      setGroupIdInput(initialGroupId);
      return;
    }

    if (selectedGroupId) {
      setGroupId(selectedGroupId);
      setGroupIdInput(selectedGroupId);
    }
  }, [initialGroupId, selectedGroupId]);

  const token = useMemo(() => {
    if (typeof window !== 'undefined') {
      for (const key of localStorageTokenKeys) {
        const candidate = window.localStorage.getItem(key);
        if (candidate && candidate.trim()) {
          return candidate.trim();
        }
      }
    }

    const authStateToken = (user as { access_token?: string; token?: string } | null)?.access_token ?? (user as { token?: string } | null)?.token;
    return typeof authStateToken === 'string' ? authStateToken : '';
  }, [user]);

  const mapCalendars = (payload: unknown): CalendarRow[] => {
    return readArray(payload)
      .map((row) => {
        const id = toStr(row.group_calendar_id ?? row.calendar_id ?? row.id);
        if (!id) {
          return null;
        }

        return {
          id,
          name: toStr(row.calendar_name ?? row.name) || `Calendar ${id}`,
        };
      })
      .filter((row): row is CalendarRow => row !== null);
  };

  const mapEvents = (payload: unknown, activeCalendarId: string): EventRow[] => {
    return readArray(payload)
      .map((row) => {
        const id = toStr(row.group_calendar_event_id ?? row.calendar_event_id ?? row.event_id ?? row.id);
        if (!id) {
          return null;
        }

        return {
          id,
          groupCalendarId: toStr(row.group_calendar_id ?? activeCalendarId),
          kind: toStr(row.kind) || 'event',
          name: toStr(row.name),
          location: toStr(row.location),
          allDay: toBool(row.all_day),
          startAt: toStr(row.start_at),
          endAt: toStr(row.end_at),
          timezone: toStr(row.timezone),
          countN: row.count_n == null ? '' : String(row.count_n),
          untilAt: toStr(row.until_at),
          originalStartAt: toStr(row.original_start_at),
          rrule: toStr(row.rrule),
          parentId: toStr(row.parent_id),
          isCancelled: toBool(row.is_cancelled),
          isGlobal: toBool(row.is_global),
        };
      })
      .filter((row): row is EventRow => row !== null);
  };

  const loadEvents = async (nextCalendarId: string, nextGroupId: string) => {
    if (!nextGroupId || !nextCalendarId) {
      setEvents([]);
      return;
    }

    setIsLoadingEvents(true);
    setErrorMessage('');

    try {
      const response = await postGroupCalendarEventGet(token, {
        group_id: nextGroupId,
        group_calendar_id: nextCalendarId,
        include_cancelled: includeCancelled,
      });

      setEvents(mapEvents(response.data, nextCalendarId));
    } catch (error) {
      const message = getErrorMessage(error);
      setEvents([]);
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsLoadingEvents(false);
    }
  };

  const bootstrap = async (nextGroupId: string) => {
    if (!nextGroupId) {
      setCalendars([]);
      setCalendarId('');
      setEvents([]);
      return;
    }

    setIsLoadingCalendars(true);
    setErrorMessage('');

    try {
      const response = await postGroupCalendarGet(token, { group_id: nextGroupId });
      const nextCalendars = mapCalendars(response.data);
      setCalendars(nextCalendars);

      const fallbackCalendarId = nextCalendars[0]?.id ?? '';
      const activeCalendarId = nextCalendars.find((row) => row.id === calendarId)?.id ?? fallbackCalendarId;

      setCalendarId(activeCalendarId);
      await loadEvents(activeCalendarId, nextGroupId);
    } catch (error) {
      const message = getErrorMessage(error);
      setCalendars([]);
      setCalendarId('');
      setEvents([]);
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsLoadingCalendars(false);
    }
  };

  useEffect(() => {
    if (!groupId) {
      return;
    }

    void bootstrap(groupId);
    // includeCancelled should reload events from event/get after calendars are known.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, includeCancelled, token]);

  const resetForm = () => {
    setEditingEventId('');
    setEventForm(initialFormState);
  };

  const handleCreateEvent = async (submitEvent: FormEvent) => {
    submitEvent.preventDefault();

    if (!groupId || !calendarId) {
      const message = 'Missing group_id or group_calendar_id.';
      setErrorMessage(message);
      toast.error(message);
      return;
    }

    if (!eventForm.kind.trim() || !eventForm.name.trim()) {
      const message = 'kind and name are required.';
      setErrorMessage(message);
      toast.error(message);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const payload = compactPayload({
        group_id: groupId,
        group_calendar_id: calendarId,
        kind: eventForm.kind.trim(),
        name: eventForm.name.trim(),
        location: eventForm.location.trim(),
        all_day: eventForm.all_day,
        start_at: fromLocalDateTimeInput(eventForm.start_at),
        end_at: fromLocalDateTimeInput(eventForm.end_at),
        timezone: eventForm.timezone.trim(),
        count_n: eventForm.count_n.trim() ? Number(eventForm.count_n) : undefined,
        until_at: fromLocalDateTimeInput(eventForm.until_at),
        original_start_at: fromLocalDateTimeInput(eventForm.original_start_at),
        rrule: eventForm.rrule.trim(),
        parent_id: eventForm.parent_id.trim(),
        is_cancelled: eventForm.is_cancelled,
        is_global: eventForm.is_global,
      });

      await postGroupCalendarEventCreate(token, payload);
      toast.success('Event created successfully.');
      resetForm();
      await loadEvents(calendarId, groupId);
    } catch (error) {
      const message = getErrorMessage(error);
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleModifyEvent = async (submitEvent: FormEvent) => {
    submitEvent.preventDefault();

    if (!editingEventId || !groupId || !calendarId) {
      const message = 'Select an event to modify.';
      setErrorMessage(message);
      toast.error(message);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const payload = compactPayload({
        group_id: groupId,
        group_calendar_id: calendarId,
        group_calendar_event_id: editingEventId,
        kind: eventForm.kind.trim(),
        name: eventForm.name.trim(),
        location: eventForm.location.trim(),
        all_day: eventForm.all_day,
        start_at: fromLocalDateTimeInput(eventForm.start_at),
        end_at: fromLocalDateTimeInput(eventForm.end_at),
        timezone: eventForm.timezone.trim(),
        count_n: eventForm.count_n.trim() ? Number(eventForm.count_n) : undefined,
        until_at: fromLocalDateTimeInput(eventForm.until_at),
        original_start_at: fromLocalDateTimeInput(eventForm.original_start_at),
        rrule: eventForm.rrule.trim(),
        parent_id: eventForm.parent_id.trim(),
        is_cancelled: eventForm.is_cancelled,
        is_global: eventForm.is_global,
      });

      await postGroupCalendarEventModify(token, payload);
      toast.success('Event modified successfully.');
      resetForm();
      await loadEvents(calendarId, groupId);
    } catch (error) {
      const message = getErrorMessage(error);
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!groupId || !calendarId) {
      const message = 'Missing group_id or group_calendar_id.';
      setErrorMessage(message);
      toast.error(message);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      await postGroupCalendarEventDelete(token, {
        group_id: groupId,
        group_calendar_id: calendarId,
        group_calendar_event_id: eventId,
      });

      toast.success('Event deleted successfully.');

      if (editingEventId === eventId) {
        resetForm();
      }

      await loadEvents(calendarId, groupId);
    } catch (error) {
      const message = getErrorMessage(error);
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const upsertButtonLabel = editingEventId ? 'Save changes' : 'Create event';

  return (
    <section className="space-y-6">
      <div className="surface rounded-xl p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="grid gap-1">
            <label className="text-xs text-[var(--text-secondary)]">group_id</label>
            <input
              value={groupIdInput}
              onChange={(event) => setGroupIdInput(event.target.value)}
              disabled={Boolean(initialGroupId)}
              className="rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 text-sm"
              placeholder="Enter group id"
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => setGroupId(groupIdInput.trim())}
              disabled={isLoadingCalendars || isLoadingEvents || isSubmitting || Boolean(initialGroupId)}
              className="h-[var(--btn-height-md)] rounded-[var(--btn-radius)] border border-[var(--border-default)] px-[var(--btn-padding)] text-sm"
            >
              Use group
            </button>
          </div>

          <div className="grid gap-1">
            <label className="text-xs text-[var(--text-secondary)]">group_calendar_id</label>
            <select
              value={calendarId}
              onChange={(event) => {
                const nextCalendarId = event.target.value;
                setCalendarId(nextCalendarId);
                void loadEvents(nextCalendarId, groupId);
              }}
              className="rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 text-sm"
              disabled={!groupId || isLoadingCalendars || isSubmitting}
            >
              <option value="">Select calendar</option>
              {calendars.map((calendar) => (
                <option value={calendar.id} key={calendar.id}>
                  {calendar.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={includeCancelled}
                onChange={(event) => setIncludeCancelled(event.target.checked)}
                disabled={isLoadingCalendars || isLoadingEvents || isSubmitting}
              />
              include_cancelled
            </label>
            <button
              type="button"
              onClick={() => void bootstrap(groupId)}
              disabled={!groupId || isLoadingCalendars || isLoadingEvents || isSubmitting}
              className="h-[var(--btn-height-md)] rounded-[var(--btn-radius)] border border-[var(--border-default)] px-[var(--btn-padding)] text-sm"
            >
              Refresh
            </button>
          </div>
        </div>

        {isLoadingCalendars ? <p className="mt-3 text-sm text-[var(--text-secondary)]">Loading calendars...</p> : null}
        {isLoadingEvents ? <p className="mt-1 text-sm text-[var(--text-secondary)]">Loading events...</p> : null}
        {errorMessage ? <p className="mt-3 text-sm text-[var(--error)]">{errorMessage}</p> : null}
      </div>

      <div className="surface rounded-xl p-4">
        <h2 className="mb-4 text-lg font-semibold">{editingEventId ? 'Modify event' : 'Create event'}</h2>

        <form className="grid gap-3 md:grid-cols-2" onSubmit={editingEventId ? handleModifyEvent : handleCreateEvent}>
          <div className="grid gap-1">
            <label className="text-xs text-[var(--text-secondary)]">kind</label>
            <input
              value={eventForm.kind}
              onChange={(event) => setEventForm((prev) => ({ ...prev, kind: event.target.value }))}
              className="rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 text-sm"
              required
            />
          </div>

          <div className="grid gap-1">
            <label className="text-xs text-[var(--text-secondary)]">name</label>
            <input
              value={eventForm.name}
              onChange={(event) => setEventForm((prev) => ({ ...prev, name: event.target.value }))}
              className="rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 text-sm"
              required
            />
          </div>

          <div className="grid gap-1">
            <label className="text-xs text-[var(--text-secondary)]">location</label>
            <input
              value={eventForm.location}
              onChange={(event) => setEventForm((prev) => ({ ...prev, location: event.target.value }))}
              className="rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 text-sm"
            />
          </div>

          <label className="mt-6 inline-flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={eventForm.all_day}
              onChange={(event) => setEventForm((prev) => ({ ...prev, all_day: event.target.checked }))}
            />
            all_day
          </label>

          <div className="grid gap-1">
            <label className="text-xs text-[var(--text-secondary)]">start_at (ISO-8601)</label>
            <input
              type="datetime-local"
              value={eventForm.start_at}
              onChange={(event) => setEventForm((prev) => ({ ...prev, start_at: event.target.value }))}
              className="rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 text-sm"
            />
          </div>

          <div className="grid gap-1">
            <label className="text-xs text-[var(--text-secondary)]">end_at (ISO-8601)</label>
            <input
              type="datetime-local"
              value={eventForm.end_at}
              onChange={(event) => setEventForm((prev) => ({ ...prev, end_at: event.target.value }))}
              className="rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 text-sm"
            />
          </div>

          <div className="grid gap-1">
            <label className="text-xs text-[var(--text-secondary)]">timezone</label>
            <input
              value={eventForm.timezone}
              onChange={(event) => setEventForm((prev) => ({ ...prev, timezone: event.target.value }))}
              className="rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 text-sm"
            />
          </div>

          <div className="grid gap-1">
            <label className="text-xs text-[var(--text-secondary)]">count_n</label>
            <input
              type="number"
              min={0}
              value={eventForm.count_n}
              onChange={(event) => setEventForm((prev) => ({ ...prev, count_n: event.target.value }))}
              className="rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 text-sm"
            />
          </div>

          <div className="grid gap-1">
            <label className="text-xs text-[var(--text-secondary)]">until_at (ISO-8601)</label>
            <input
              type="datetime-local"
              value={eventForm.until_at}
              onChange={(event) => setEventForm((prev) => ({ ...prev, until_at: event.target.value }))}
              className="rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 text-sm"
            />
          </div>

          <div className="grid gap-1">
            <label className="text-xs text-[var(--text-secondary)]">original_start_at (ISO-8601)</label>
            <input
              type="datetime-local"
              value={eventForm.original_start_at}
              onChange={(event) => setEventForm((prev) => ({ ...prev, original_start_at: event.target.value }))}
              className="rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 text-sm"
            />
          </div>

          <div className="grid gap-1">
            <label className="text-xs text-[var(--text-secondary)]">rrule</label>
            <input
              value={eventForm.rrule}
              onChange={(event) => setEventForm((prev) => ({ ...prev, rrule: event.target.value }))}
              className="rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 text-sm"
            />
          </div>

          <div className="grid gap-1">
            <label className="text-xs text-[var(--text-secondary)]">parent_id</label>
            <input
              value={eventForm.parent_id}
              onChange={(event) => setEventForm((prev) => ({ ...prev, parent_id: event.target.value }))}
              className="rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 text-sm"
            />
          </div>

          <label className="mt-6 inline-flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={eventForm.is_cancelled}
              onChange={(event) => setEventForm((prev) => ({ ...prev, is_cancelled: event.target.checked }))}
            />
            is_cancelled
          </label>

          <label className="mt-6 inline-flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={eventForm.is_global}
              onChange={(event) => setEventForm((prev) => ({ ...prev, is_global: event.target.checked }))}
            />
            is_global
          </label>

          <div className="md:col-span-2 flex gap-2 pt-2">
            <button
              type="submit"
              disabled={isSubmitting || isLoadingCalendars || isLoadingEvents || !groupId || !calendarId}
              className="h-[var(--btn-height-md)] rounded-[var(--btn-radius)] border border-transparent bg-[var(--accent)] px-[var(--btn-padding)] text-sm text-white"
            >
              {isSubmitting ? 'Saving...' : upsertButtonLabel}
            </button>
            {editingEventId ? (
              <button
                type="button"
                onClick={resetForm}
                disabled={isSubmitting}
                className="h-[var(--btn-height-md)] rounded-[var(--btn-radius)] border border-[var(--border-default)] px-[var(--btn-padding)] text-sm"
              >
                Cancel edit
              </button>
            ) : null}
          </div>
        </form>
      </div>

      <div className="surface rounded-xl p-4">
        <h2 className="mb-4 text-lg font-semibold">Events ({events.length})</h2>

        {!groupId ? <p className="text-sm text-[var(--text-secondary)]">Select a group to start.</p> : null}
        {groupId && !calendarId ? <p className="text-sm text-[var(--text-secondary)]">No calendar found for this group.</p> : null}

        {calendarId ? (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--border-default)] text-left">
                  <th className="px-2 py-2 font-medium">name</th>
                  <th className="px-2 py-2 font-medium">kind</th>
                  <th className="px-2 py-2 font-medium">start_at</th>
                  <th className="px-2 py-2 font-medium">end_at</th>
                  <th className="px-2 py-2 font-medium">timezone</th>
                  <th className="px-2 py-2 font-medium">flags</th>
                  <th className="px-2 py-2 font-medium">actions</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id} className="border-b border-[var(--border-default)] align-top">
                    <td className="px-2 py-2">
                      <div className="font-medium">{event.name || '-'}</div>
                      <div className="text-xs text-[var(--text-secondary)]">id: {event.id}</div>
                    </td>
                    <td className="px-2 py-2">{event.kind || '-'}</td>
                    <td className="px-2 py-2">{event.startAt || '-'}</td>
                    <td className="px-2 py-2">{event.endAt || '-'}</td>
                    <td className="px-2 py-2">{event.timezone || '-'}</td>
                    <td className="px-2 py-2">
                      <div>all_day: {String(event.allDay)}</div>
                      <div>is_cancelled: {String(event.isCancelled)}</div>
                      <div>is_global: {String(event.isGlobal)}</div>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingEventId(event.id);
                            setEventForm(toEventFormState(event));
                          }}
                          disabled={isSubmitting}
                          className="rounded-md border border-[var(--border-default)] px-2 py-1 text-xs"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteEvent(event.id)}
                          disabled={isSubmitting}
                          className="rounded-md border border-[var(--error)] px-2 py-1 text-xs text-[var(--error)]"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  );
}
