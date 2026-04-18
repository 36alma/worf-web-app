/** FullCalendar-powered month/week/day view and event interactions. */
'use client';

import { useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import allLocales from '@fullcalendar/core/locales-all';
import type { EventClickArg, EventDropArg } from '@fullcalendar/core';
import type { DateClickArg } from '@fullcalendar/interaction';
import Skeleton from '@/components/ui/Skeleton';
import Toast from '@/src/components/ui/Toast';
import EventModal from '@/src/components/calendar/EventModal';
import type { GroupCalendarEvent } from '@/src/types/calendar.types';
import { useEvents } from '@/src/hooks/useEvents';
import { useCreateEvent } from '@/src/hooks/useCreateEvent';
import { useUpdateEvent } from '@/src/hooks/useUpdateEvent';
import { useDeleteEvent } from '@/src/hooks/useDeleteEvent';

/**
 * Props for calendar grid view.
 */
export interface CalendarViewProps {
  groupId: string;
  calendarId: string;
  canWrite?: boolean;
}

export default function CalendarView({ groupId, calendarId, canWrite = true }: CalendarViewProps) {
  const { events, loading, error } = useEvents(groupId, calendarId, { scope: 'all' });
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<GroupCalendarEvent | null>(null);
  const [modalSubmitting, setModalSubmitting] = useState(false);

  const eventItems = useMemo(
    () =>
      events.map((event) => ({
        id: event.id,
        title: event.name,
        start: event.startAt ?? undefined,
        end: event.endAt ?? undefined,
        allDay: event.allDay,
        classNames: event.isCancelled ? ['line-through', 'opacity-70'] : [],
        backgroundColor: event.isGlobal ? '#0ea5e9' : '#ff6b2c',
        borderColor: 'transparent',
        extendedProps: {
          source: event
        }
      })),
    [events]
  );

  const onDateClick = (arg: DateClickArg) => {
    setEditingEvent({
      id: '',
      groupId,
      calendarId,
      kind: 'event',
      name: '',
      parentId: null,
      location: null,
      allDay: arg.allDay,
      startAt: arg.date.toISOString(),
      endAt: arg.date.toISOString(),
      rrule: null,
      untilAt: null,
      countN: null,
      originalStartAt: null,
      isCancelled: false,
      timezone: 'Europe/Budapest',
      isGlobal: false,
      raw: {}
    });
    setModalOpen(true);
  };

  const onEventClick = (arg: EventClickArg) => {
    const source = arg.event.extendedProps.source as GroupCalendarEvent | undefined;
    if (!source) return;
    setEditingEvent(source);
    setModalOpen(true);
  };

  const onEventDrop = (arg: EventDropArg) => {
    const source = arg.event.extendedProps.source as GroupCalendarEvent | undefined;
    if (!source || !arg.event.start) {
      arg.revert();
      return;
    }
    void updateEvent({
      groupId,
      calendarId,
      eventId: source.id,
      isGlobal: source.isGlobal,
      updates: {
        kind: source.kind,
        name: source.name,
        start_at: arg.event.start.toISOString(),
        end_at: arg.event.end ? arg.event.end.toISOString() : arg.event.start.toISOString(),
        all_day: arg.event.allDay
      }
    })
      .then(() => Toast.success('Esemény áthelyezve.'))
      .catch(() => {
        arg.revert();
      });
  };

  const handleSave = async (
    payload: { kind: string; name: string; location?: string; all_day: boolean; start_at?: string; end_at?: string; rrule?: string; timezone?: string },
    _scope: 'single' | 'future' | 'all'
  ) => {
    setModalSubmitting(true);
    try {
      if (!editingEvent?.id) {
        await createEvent({
          groupId,
          calendarId,
          event: {
            ...payload,
            location: payload.location ?? null,
            start_at: payload.start_at ?? null,
            end_at: payload.end_at ?? null,
            rrule: payload.rrule ?? null,
            timezone: payload.timezone ?? null,
            is_global: false
          }
        });
        Toast.success('Esemény létrehozva.');
      } else {
        await updateEvent({
          groupId,
          calendarId,
          eventId: editingEvent.id,
          isGlobal: editingEvent.isGlobal,
          updates: {
            ...payload,
            location: payload.location ?? null,
            start_at: payload.start_at ?? null,
            end_at: payload.end_at ?? null,
            rrule: payload.rrule ?? null,
            timezone: payload.timezone ?? null
          }
        });
        Toast.success('Esemény frissítve.');
      }
      setModalOpen(false);
      setEditingEvent(null);
    } finally {
      setModalSubmitting(false);
    }
  };

  return (
    <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
      {loading ? <Skeleton className="h-[520px] w-full" /> : null}
      {error ? <p className="mb-2 text-sm text-red-300">{error}</p> : null}

      {!loading ? (
        <div className="worf-calendar">
          <FullCalendar
            locales={allLocales}
            locale="hu"
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
            buttonText={{ today: 'Ma', month: 'Hónap', week: 'Hét', day: 'Nap' }}
            selectable
            editable
            events={eventItems}
            dateClick={onDateClick}
            eventClick={onEventClick}
            eventDrop={onEventDrop}
            height="auto"
          />
        </div>
      ) : null}

      <EventModal
        open={modalOpen}
        mode={editingEvent?.id ? 'edit' : 'create'}
        initialEvent={editingEvent}
        submitting={modalSubmitting}
        onClose={() => {
          setModalOpen(false);
          setEditingEvent(null);
        }}
        onSave={handleSave}
        onDelete={
          editingEvent?.id
            ? async () => {
                await deleteEvent({ groupId, calendarId, eventId: editingEvent.id, isGlobal: editingEvent.isGlobal });
                Toast.success('Esemény törölve.');
                setModalOpen(false);
                setEditingEvent(null);
              }
            : undefined
        }
      />
    </section>
  );
}
