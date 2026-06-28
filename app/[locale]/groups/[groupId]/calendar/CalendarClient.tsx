'use client';

import {useEffect, useRef, useState} from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type {EventResizeDoneArg} from '@fullcalendar/interaction';
import allLocales from '@fullcalendar/core/locales-all';
import type {DateClickArg} from '@fullcalendar/interaction';
import type {DateSelectArg, DatesSetArg, EventClickArg, EventDropArg} from '@fullcalendar/core';
import {CalendarDays, Plus} from 'lucide-react';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Skeleton from '@/components/ui/Skeleton';
import {useCalendarPermissions} from './hooks/useCalendarPermissions';
import {useCalendarData} from './hooks/useCalendarData';
import CalendarFormModal from './components/CalendarFormModal';
import CalendarSelector from './components/CalendarSelector';
import EventFormModal from './components/EventFormModal';
import EventViewModal from './components/EventViewModal';
import {toFullCalendarEvent} from './utils/calendarMappers';
import type {
  CalendarCopy,
  CalendarViewMode,
  EventDraftRange,
  GroupCalendarEventItem,
  GroupCalendarItem,
  SupportedLocale
} from './types';

interface CalendarClientProps {
  groupId: string;
  locale: string;
}

const MOBILE_BREAKPOINT = 768;
const MOBILE_DEFAULT_VIEW: CalendarViewMode = 'timeGridDay';
const DESKTOP_DEFAULT_VIEW: CalendarViewMode = 'dayGridMonth';
const DOUBLE_TAP_DELAY_MS = 300;

const getCalendarCopy = (locale: SupportedLocale): CalendarCopy =>
  locale === 'hu'
    ? {
        title: 'Csoportnaptár',
        subtitle: 'Közös események, feladatok és emlékeztetők egy helyen.',
        loading: 'Naptár betöltése...',
        loadingEvents: 'Események betöltése...',
        emptyTitle: 'A naptár most nem érhető el',
        emptyDescription: 'Ehhez a csoporthoz jelenleg nincs megjeleníthető naptárnézet.',
        noCalendarTitle: 'Még nincs csoportnaptár',
        noCalendarDescription: 'Hozz létre egy naptárat, és utána itt jelennek meg az események.',
        createCalendar: 'Naptár létrehozása',
        editCalendar: 'Naptár szerkesztése',
        deleteCalendar: 'Naptár törlése',
        createEvent: 'Esemény létrehozása',
        editEvent: 'Szerkesztés',
        deleteEvent: 'Törlés',
        close: 'Bezárás',
        cancel: 'Mégse',
        save: 'Mentés',
        confirm: 'Megerősítés',
        today: 'Ma',
        month: 'Hónap',
        week: 'Hét',
        day: 'Nap',
        calendarLabel: 'Naptárak',
        selectCalendar: 'Aktív naptár',
        eventDetails: 'Esemény részletei',
        eventName: 'Név',
        eventKind: 'Típus',
        eventStart: 'Kezdés',
        eventEnd: 'Befejezés',
        eventLocation: 'Helyszín',
        eventTimezone: 'Időzóna',
        eventDeleted: 'Törölt',
        optionalFields: 'További mezők',
        addOptionalFields: 'Hozzáadás',
        repeatLabel: 'Ismétlődés',
        repeatUntil: 'Dátumig',
        repeatCount: 'N alkalomig',
        repeatFrequency: 'Gyakoriság',
        allDay: 'Egész napos',
        calendarName: 'Naptár neve',
        calendarDescription: 'Leírás',
        validationName: 'A név megadása kötelező.',
        validationKind: 'A típus megadása kötelező.',
        validationStartEnd: 'A befejezés nem lehet korábbi, mint a kezdés.',
        validationRepeatUntil: 'Adj meg egy befejezési dátumot az ismétlődéshez.',
        validationRepeatCount: 'Adj meg legalább egy alkalmat az ismétlődéshez.',
        addSelectionHint: 'Jelölj ki egy sávot a naptárban az új esemény gyors létrehozásához.',
        deletedEventLabel: 'Törölt',
        deleteEventPrompt: 'Biztosan törölni szeretnéd ezt az eseményt?',
        deleteCalendarPrompt: 'Biztosan törölni szeretnéd ezt a naptárat?',
        toasts: {
          calendarCreated: 'A naptár létrejött.',
          calendarUpdated: 'A naptár frissült.',
          calendarDeleted: 'A naptár törölve lett.',
          eventCreated: 'Az esemény létrejött.',
          eventUpdated: 'Az esemény frissült.',
          eventDeleted: 'Az esemény törölve lett.',
          rateLimited: 'Túl sok kérés, kérjük várjon egy kicsit.'
        },
        kindLabels: {
          event: 'Esemény',
          task: 'Feladat',
          reminder: 'Emlékeztető',
          birthday: 'Születésnap'
        },
        repeatFrequencyLabels: {
          DAILY: 'Naponta',
          WEEKLY: 'Hetente',
          MONTHLY: 'Havonta',
          YEARLY: 'Évente'
        },
        emptyValue: 'Nincs megadva'
      }
    : {
        title: 'Group Calendar',
        subtitle: 'Shared events, tasks, and reminders in one place.',
        loading: 'Loading calendar...',
        loadingEvents: 'Loading events...',
        emptyTitle: 'The calendar is not available right now',
        emptyDescription: 'There is no calendar view available for this group at the moment.',
        noCalendarTitle: 'No group calendar yet',
        noCalendarDescription: 'Create a calendar first, then events will appear here.',
        createCalendar: 'Create calendar',
        editCalendar: 'Edit calendar',
        deleteCalendar: 'Delete calendar',
        createEvent: 'Create event',
        editEvent: 'Edit',
        deleteEvent: 'Delete',
        close: 'Close',
        cancel: 'Cancel',
        save: 'Save',
        confirm: 'Confirm',
        today: 'Today',
        month: 'Month',
        week: 'Week',
        day: 'Day',
        calendarLabel: 'Calendars',
        selectCalendar: 'Active calendar',
        eventDetails: 'Event details',
        eventName: 'Name',
        eventKind: 'Kind',
        eventStart: 'Start',
        eventEnd: 'End',
        eventLocation: 'Location',
        eventTimezone: 'Timezone',
        eventDeleted: 'Deleted',
        optionalFields: 'Additional fields',
        addOptionalFields: 'Add',
        repeatLabel: 'Repeat',
        repeatUntil: 'Until date',
        repeatCount: 'For N times',
        repeatFrequency: 'Frequency',
        allDay: 'All day',
        calendarName: 'Calendar name',
        calendarDescription: 'Description',
        validationName: 'Name is required.',
        validationKind: 'Kind is required.',
        validationStartEnd: 'End time cannot be earlier than the start time.',
        validationRepeatUntil: 'Provide an until date for the recurrence.',
        validationRepeatCount: 'Provide at least one occurrence for the recurrence.',
        addSelectionHint: 'Select a time range in the calendar to create a new event faster.',
        deletedEventLabel: 'Deleted',
        deleteEventPrompt: 'Do you want to delete this event?',
        deleteCalendarPrompt: 'Do you want to delete this calendar?',
        toasts: {
          calendarCreated: 'Calendar created.',
          calendarUpdated: 'Calendar updated.',
          calendarDeleted: 'Calendar deleted.',
          eventCreated: 'Event created.',
          eventUpdated: 'Event updated.',
          eventDeleted: 'Event deleted.',
          rateLimited: 'Too many requests, please wait a little.'
        },
        kindLabels: {
          event: 'Event',
          task: 'Task',
          reminder: 'Reminder',
          birthday: 'Birthday'
        },
        repeatFrequencyLabels: {
          DAILY: 'Daily',
          WEEKLY: 'Weekly',
          MONTHLY: 'Monthly',
          YEARLY: 'Yearly'
        },
        emptyValue: 'Not set'
      };

const CalendarShellSkeleton = ({copy}: {copy: CalendarCopy}) => (
  <div className="space-y-4">
    <div className="space-y-2">
      <Skeleton className="h-8 w-52" />
      <Skeleton className="h-5 w-80 max-w-full" />
    </div>
    <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
      <Skeleton className="h-12 w-full" />
    </div>
    <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
      <Skeleton className="h-[680px] w-full" />
      <p className="mt-4 text-sm text-[var(--text-secondary)]">{copy.loading}</p>
    </div>
  </div>
);

const EmptyState = ({
  icon,
  title,
  description,
  action
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) => (
  <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] px-6 py-16 text-center">
    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-secondary)]">
      {icon}
    </div>
    <h2 className="mt-6 text-xl font-semibold text-[var(--text-primary)]">{title}</h2>
    <p className="mx-auto mt-2 max-w-xl text-sm text-[var(--text-secondary)]">{description}</p>
    {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
  </div>
);

export default function CalendarClient({groupId, locale}: CalendarClientProps) {
  const normalizedLocale: SupportedLocale = locale === 'en' ? 'en' : 'hu';
  const decodedGroupId = decodeURIComponent(groupId);
  const copy = getCalendarCopy(normalizedLocale);
  const calendarRef = useRef<FullCalendar | null>(null);
  const lastDateTapRef = useRef<{cellKey: string; timestamp: number}>({
    cellKey: '',
    timestamp: 0
  });
  const [isMobile, setIsMobile] = useState(false);
  const [currentView, setCurrentView] = useState<CalendarViewMode>(DESKTOP_DEFAULT_VIEW);
  const [eventView, setEventView] = useState<GroupCalendarEventItem | null>(null);
  const [eventFormOpen, setEventFormOpen] = useState(false);
  const [calendarFormOpen, setCalendarFormOpen] = useState(false);
  const [calendarFormMode, setCalendarFormMode] = useState<'create' | 'edit'>('create');
  const [calendarToEdit, setCalendarToEdit] = useState<GroupCalendarItem | null>(null);
  const [eventFormMode, setEventFormMode] = useState<'create' | 'edit'>('create');
  const [eventToEdit, setEventToEdit] = useState<GroupCalendarEventItem | null>(null);
  const [eventDraftRange, setEventDraftRange] = useState<EventDraftRange | null>(null);
  const [calendarDeleteOpen, setCalendarDeleteOpen] = useState(false);

  const permissions = useCalendarPermissions({
    groupId: decodedGroupId,
    locale: normalizedLocale
  });

  const calendarData = useCalendarData({
    groupId: decodedGroupId,
    locale: normalizedLocale,
    enabled: permissions.canRead,
    copy
  });

  const browserTimezone =
    typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' : 'UTC';

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const syncViewport = () => {
      const nextIsMobile = window.innerWidth < MOBILE_BREAKPOINT;

      setIsMobile((previousIsMobile) => {
        if (previousIsMobile === nextIsMobile) {
          return previousIsMobile;
        }

        const nextView = nextIsMobile ? MOBILE_DEFAULT_VIEW : DESKTOP_DEFAULT_VIEW;
        setCurrentView(nextView);
        calendarRef.current?.getApi().changeView(nextView);
        return nextIsMobile;
      });
    };

    syncViewport();
    window.addEventListener('resize', syncViewport);

    return () => {
      window.removeEventListener('resize', syncViewport);
    };
  }, []);

  const openCreateCalendar = () => {
    setCalendarFormMode('create');
    setCalendarToEdit(null);
    setCalendarFormOpen(true);
  };

  const openEditCalendar = () => {
    if (!calendarData.activeCalendar) {
      return;
    }

    setCalendarFormMode('edit');
    setCalendarToEdit(calendarData.activeCalendar);
    setCalendarFormOpen(true);
  };

  const openCreateEvent = (range?: EventDraftRange | null) => {
    setEventView(null);
    setEventToEdit(null);
    setEventFormMode('create');
    setEventDraftRange(range ?? null);
    setEventFormOpen(true);
  };

  const openEditEvent = (event: GroupCalendarEventItem) => {
    setEventView(null);
    setEventToEdit(event);
    setEventFormMode('edit');
    setEventDraftRange(null);
    setEventFormOpen(true);
  };

  const handleDateSelect = (selection: DateSelectArg) => {
    if (!permissions.canManageEvents || !calendarData.activeCalendarId) {
      return;
    }

    // For allDay selections, if it's a single day (end is exactly 1 day after start), we make endAt the same as startAt.
    // FullCalendar's allDay selection end is exclusive, so a 1-day selection has end = start + 1 day.
    let endAt = selection.endStr;
    if (selection.allDay && selection.start && selection.end) {
      const diffDays = Math.round((selection.end.getTime() - selection.start.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays <= 1) {
        endAt = selection.startStr;
      }
    }

    openCreateEvent({
      startAt: selection.startStr || null,
      endAt: endAt || null,
      allDay: selection.allDay
    });
    selection.view.calendar.unselect();
  };

  const handleDateClick = (dateClick: DateClickArg) => {
    if (!isMobile || !permissions.canManageEvents || !calendarData.activeCalendarId) {
      return;
    }

    const now = Date.now();
    const cellKey = `${dateClick.dateStr}::${dateClick.allDay ? 'all-day' : 'timed'}::${dateClick.view.type}`;
    const previousTap = lastDateTapRef.current;
    const isDoubleTap =
      previousTap.cellKey === cellKey && now - previousTap.timestamp <= DOUBLE_TAP_DELAY_MS;

    lastDateTapRef.current = {
      cellKey,
      timestamp: now
    };

    if (!isDoubleTap) {
      return;
    }

    lastDateTapRef.current = {
      cellKey: '',
      timestamp: 0
    };

    openCreateEvent({
      startAt: dateClick.dateStr,
      endAt: dateClick.dateStr,
      allDay: dateClick.allDay
    });
  };

  const handleEventClick = (eventClick: EventClickArg) => {
    const source = eventClick.event.extendedProps.source as GroupCalendarEventItem | undefined;

    if (source) {
      setEventView(source);
    }
  };

  const handleEventDrop = async (eventDrop: EventDropArg) => {
    const source = eventDrop.event.extendedProps.source as GroupCalendarEventItem | undefined;

    if (!source) {
      eventDrop.revert();
      return;
    }

    try {
      await calendarData.updateEventSchedule(source, {
        start_at: eventDrop.event.start?.toISOString() ?? null,
        end_at: eventDrop.event.end?.toISOString() ?? eventDrop.event.start?.toISOString() ?? null,
        all_day: eventDrop.event.allDay
      });
    } catch {
      eventDrop.revert();
    }
  };

  const handleEventResize = async (eventResize: EventResizeDoneArg) => {
    const source = eventResize.event.extendedProps.source as GroupCalendarEventItem | undefined;

    if (!source) {
      eventResize.revert();
      return;
    }

    try {
      await calendarData.updateEventSchedule(source, {
        start_at: eventResize.event.start?.toISOString() ?? null,
        end_at: eventResize.event.end?.toISOString() ?? null,
        all_day: eventResize.event.allDay
      });
    } catch {
      eventResize.revert();
    }
  };

  const handleDatesSet = (dateInfo: DatesSetArg) => {
    setCurrentView(dateInfo.view.type as CalendarViewMode);
  };

  const headerToolbar = isMobile
    ? {
        left: 'prev,next today',
        center: 'title',
        right: 'timeGridDay,dayGridMonth'
      }
    : {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,timeGridDay'
      };

  if (permissions.isLoading) {
    return <CalendarShellSkeleton copy={copy} />;
  }

  if (!permissions.canRead) {
    return (
      <EmptyState
        icon={<CalendarDays size={26} strokeWidth={1.75} />}
        title={copy.emptyTitle}
        description={copy.emptyDescription}
      />
    );
  }

  if (!calendarData.isCalendarsLoading && calendarData.calendars.length === 0) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="display-font text-3xl font-semibold text-[var(--text-primary)]">{copy.title}</h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">{copy.subtitle}</p>
        </header>

        <EmptyState
          icon={<CalendarDays size={26} strokeWidth={1.75} />}
          title={copy.noCalendarTitle}
          description={copy.noCalendarDescription}
          action={
            permissions.canManageCalendars ? (
              <Button type="button" onClick={openCreateCalendar} startIcon={<Plus size={16} strokeWidth={1.75} />}>
                {copy.createCalendar}
              </Button>
            ) : undefined
          }
        />

        <CalendarFormModal
          open={calendarFormOpen}
          mode={calendarFormMode}
          copy={copy}
          calendar={calendarToEdit}
          submitting={calendarData.isMutating}
          onClose={() => setCalendarFormOpen(false)}
          onSubmit={async (values) => {
            await calendarData.createCalendar(values);
            setCalendarFormOpen(false);
          }}
        />
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="display-font text-3xl font-semibold text-[var(--text-primary)]">{copy.title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">{copy.subtitle}</p>
        </div>

        {permissions.canManageEvents && calendarData.activeCalendar ? (
          <Button type="button" onClick={() => openCreateEvent()} startIcon={<Plus size={16} strokeWidth={1.75} />}>
            {copy.createEvent}
          </Button>
        ) : null}
      </header>

      <CalendarSelector
        copy={copy}
        calendars={calendarData.calendars}
        activeCalendarId={calendarData.activeCalendarId}
        canManageCalendars={permissions.canManageCalendars}
        isBusy={calendarData.isCalendarsLoading || calendarData.isEventsLoading || calendarData.isMutating}
        onSelect={(calendarId) => {
          void calendarData.selectCalendar(calendarId);
        }}
        onCreate={openCreateCalendar}
        onEdit={openEditCalendar}
        onDelete={() => setCalendarDeleteOpen(true)}
      />

      <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 md:p-5">
        <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-sm text-[var(--text-secondary)]">{copy.addSelectionHint}</p>
          {calendarData.isEventsLoading ? (
            <span className="text-sm text-[var(--text-secondary)]">{copy.loadingEvents}</span>
          ) : null}
        </div>

        <div className="worf-calendar">
          {calendarData.isCalendarsLoading ? (
            <Skeleton className="h-[680px] w-full" />
          ) : (
            <FullCalendar
              ref={calendarRef}
              locales={allLocales}
              locale={normalizedLocale}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView={currentView}
              headerToolbar={headerToolbar}
              buttonText={{
                today: copy.today,
                month: copy.month,
                week: copy.week,
                day: copy.day
              }}
              editable={permissions.canManageEvents}
              eventStartEditable={permissions.canManageEvents}
              eventDurationEditable={permissions.canManageEvents}
              droppable={permissions.canManageEvents}
              selectable={permissions.canManageEvents}
              eventLongPressDelay={400}
              selectLongPressDelay={400}
              selectMirror
              nowIndicator
              height="auto"
              events={calendarData.events.map(toFullCalendarEvent)}
              select={handleDateSelect}
              dateClick={handleDateClick}
              datesSet={handleDatesSet}
              eventClick={handleEventClick}
              eventDrop={handleEventDrop}
              eventResize={handleEventResize}
            />
          )}
        </div>
      </div>

      <CalendarFormModal
        open={calendarFormOpen}
        mode={calendarFormMode}
        copy={copy}
        calendar={calendarToEdit}
        submitting={calendarData.isMutating}
        onClose={() => setCalendarFormOpen(false)}
        onSubmit={async (values) => {
          if (calendarFormMode === 'create') {
            await calendarData.createCalendar(values);
          } else if (calendarToEdit) {
            await calendarData.updateCalendar(calendarToEdit, values);
          }

          setCalendarFormOpen(false);
        }}
      />

      <EventViewModal
        open={Boolean(eventView)}
        locale={normalizedLocale}
        copy={copy}
        event={eventView}
        canManageEvents={permissions.canManageEvents}
        isDeleting={calendarData.isMutating}
        onClose={() => setEventView(null)}
        onEdit={() => {
          if (eventView) {
            openEditEvent(eventView);
          }
        }}
        onDelete={async () => {
          if (!eventView) {
            return;
          }

          await calendarData.deleteEvent(eventView);
          setEventView(null);
        }}
      />

      <EventFormModal
        open={eventFormOpen}
        mode={eventFormMode}
        copy={copy}
        locale={normalizedLocale}
        event={eventToEdit}
        initialRange={eventDraftRange}
        timezone={browserTimezone}
        submitting={calendarData.isMutating}
        onClose={() => {
          setEventFormOpen(false);
          setEventToEdit(null);
          setEventDraftRange(null);
        }}
        onSubmit={async (values) => {
          if (eventFormMode === 'create') {
            await calendarData.createEvent(values);
          } else if (eventToEdit) {
            await calendarData.updateEvent(eventToEdit, values);
          }

          setEventFormOpen(false);
          setEventToEdit(null);
          setEventDraftRange(null);
        }}
      />

      <ConfirmDialog
        open={calendarDeleteOpen}
        title={copy.deleteCalendar}
        message={copy.deleteCalendarPrompt}
        onCancel={() => setCalendarDeleteOpen(false)}
        onConfirm={async () => {
          if (!calendarData.activeCalendar) {
            return;
          }

          await calendarData.deleteCalendar(calendarData.activeCalendar);
          setCalendarDeleteOpen(false);
        }}
        cancelLabel={copy.cancel}
        confirmLabel={copy.confirm}
      />
    </section>
  );
}
