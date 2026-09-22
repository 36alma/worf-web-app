'use client';

import {useEffect, useMemo, useRef, useState} from 'react';
import toast from 'react-hot-toast';
import EventFormModal from '@/app/[locale]/groups/[groupId]/calendar/components/EventFormModal';
import EventViewModal from '@/app/[locale]/groups/[groupId]/calendar/components/EventViewModal';
import {getCalendarCopy} from '@/app/[locale]/groups/[groupId]/calendar/copy';
import {useCalendarData} from '@/app/[locale]/groups/[groupId]/calendar/hooks/useCalendarData';
import {mapEventsPayload} from '@/app/[locale]/groups/[groupId]/calendar/utils/calendarMappers';
import type {GroupCalendarEventItem, SupportedLocale} from '@/app/[locale]/groups/[groupId]/calendar/types';
import {useGroupPermission} from '@/components/providers/GroupPermissionContext';
import {loadCalendars, loadEvents, type ChipRef} from '../entities';
import {useOpenErrorToast, type EntityHostProps} from './shared';

const toEventItem = (raw: Record<string, any>): GroupCalendarEventItem | null =>
  mapEventsPayload([raw], String(raw.group_calendar_id ?? ''))[0] ?? null;

/** The calendar page's own modals: `EventFormModal` to create/edit, `EventViewModal` to open a chip. */
export default function EventEntityModals({ctx, request, onDone}: EntityHostProps) {
  const locale: SupportedLocale = ctx.locale === 'en' ? 'en' : 'hu';
  const copy = useMemo(() => getCalendarCopy(locale), [locale]);
  const {hasPermission} = useGroupPermission();
  const reportOpenError = useOpenErrorToast();
  const createdRef = useRef<ChipRef[]>([]);
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', []);

  // Mutations only (create/update/delete keep the page's toasts and payload mapping); the calendars and
  // the event to show are looked up below, so the hook's own list loading stays off.
  const data = useCalendarData({groupId: ctx.groupId, locale, enabled: false, copy});

  const [calendars, setCalendars] = useState<{id: string; name: string}[] | null>(null);
  const [calendarId, setCalendarId] = useState('');
  const [event, setEvent] = useState<GroupCalendarEventItem | null>(() =>
    request.mode === 'modify' ? toEventItem(request.item.raw ?? {}) : null
  );
  const [phase, setPhase] = useState<'view' | 'edit'>(request.mode === 'view' ? 'view' : 'edit');

  useEffect(() => {
    if (request.mode !== 'create') return;
    let mounted = true;
    loadCalendars(ctx)
      .then((loaded) => {
        if (!mounted) return;
        if (loaded.length === 0) {
          toast.error(copy.noCalendarTitle);
          onDone();
          return;
        }
        setCalendars(loaded);
        setCalendarId(loaded[0].id);
      })
      .catch((error) => {
        if (!mounted) return;
        reportOpenError(error);
        onDone();
      });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (request.mode !== 'view') return;
    let mounted = true;
    loadEvents(ctx)
      .then((events) => {
        if (!mounted) return;
        const found = events.find((item) => item.id === request.ref.id);
        const mapped = found?.raw ? toEventItem(found.raw) : null;
        if (mapped) {
          setEvent(mapped);
        } else {
          reportOpenError(Object.assign(new Error('event_not_found'), {response: {status: 404}}));
          onDone();
        }
      })
      .catch((error) => {
        if (!mounted) return;
        reportOpenError(error);
        onDone();
      });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (request.mode === 'create') {
    if (!calendars) return null;
    return (
      <EventFormModal
        open
        mode="create"
        copy={copy}
        locale={locale}
        event={null}
        initialRange={null}
        timezone={timezone}
        submitting={data.isMutating}
        calendars={calendars}
        calendarId={calendarId}
        onCalendarChange={setCalendarId}
        onClose={() => onDone(createdRef.current)}
        onSubmit={async (values) => {
          const id = await data.createEvent(values, calendarId);
          if (id === null) return; // the request failed — the error toast is up, keep the form open
          if (id) createdRef.current = [{type: 'event', id, label: values.name.trim()}];
          onDone(createdRef.current);
        }}
      />
    );
  }

  if (!event) return null;

  if (phase === 'view') {
    return (
      <EventViewModal
        open
        locale={locale}
        copy={copy}
        event={event}
        canManageEvents={hasPermission('group.calendar.event.write')}
        isDeleting={data.isMutating}
        onClose={() => onDone()}
        onEdit={() => setPhase('edit')}
        onDelete={async () => {
          await data.deleteEvent(event);
          onDone();
        }}
      />
    );
  }

  return (
    <EventFormModal
      open
      mode="edit"
      copy={copy}
      locale={locale}
      event={event}
      initialRange={null}
      timezone={timezone}
      submitting={data.isMutating}
      onClose={() => onDone()}
      onSubmit={async (values) => {
        await data.updateEvent(event, values);
        onDone();
      }}
    />
  );
}
