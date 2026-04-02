'use client';

import {FormEvent, useMemo, useState} from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import timeGridPlugin from '@fullcalendar/timegrid';
import type {EventDropArg} from '@fullcalendar/core';
import {CalendarPlus, Pencil, RefreshCw, Trash2} from 'lucide-react';
import toast from 'react-hot-toast';
import {useLocale, useTranslations} from 'next-intl';
import Button from '@/components/ui/Button';
import EventModal from '@/components/calendar/EventModal';
import {useCalendar} from '@/hooks/useCalendar';
import type {CalendarScope, GroupCalendarEvent} from '@/lib/types/calendar';

interface CalendarViewProps {
  initialGroupId?: string;
}

export default function CalendarView({initialGroupId}: CalendarViewProps) {
  const t = useTranslations('calendar');
  const locale = useLocale();
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [eventModalMode, setEventModalMode] = useState<'create' | 'edit'>('create');
  const [selectedEvent, setSelectedEvent] = useState<GroupCalendarEvent | null>(null);
  const [clickedDate, setClickedDate] = useState<Date | undefined>(undefined);
  const [calendarModalOpen, setCalendarModalOpen] = useState(false);
  const [calendarName, setCalendarName] = useState('');
  const [calendarDescription, setCalendarDescription] = useState('');

  const {
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
    createCalendar,
    updateCalendar,
    deleteCalendar,
    upsertEvent,
    deleteEvent,
    moveEvent
  } = useCalendar({initialGroupId});

  const eventItems = useMemo(
    () =>
      events.map((event) => ({
        id: event.id,
        title: event.name,
        allDay: event.allDay,
        start: event.startAt,
        end: event.endAt,
        className: event.isCancelled ? 'line-through opacity-60' : '',
        backgroundColor: event.isGlobal ? '#7c3aed' : '#0ea5e9',
        borderColor: 'transparent',
        extendedProps: {
          source: event
        }
      })),
    [events]
  );

  const handleEventCreate = () => {
    setSelectedEvent(null);
    setEventModalMode('create');
    setEventModalOpen(true);
  };

  const handleEventEdit = (event: GroupCalendarEvent) => {
    setSelectedEvent(event);
    setEventModalMode('edit');
    setEventModalOpen(true);
  };

  const handleCalendarCreate = async (submitEvent: FormEvent) => {
    submitEvent.preventDefault();

    if (!calendarName.trim()) {
      return;
    }

    try {
      await createCalendar(calendarName.trim(), calendarDescription.trim() || undefined);
      toast.success('Calendar created');
      setCalendarModalOpen(false);
      setCalendarName('');
      setCalendarDescription('');
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Calendar create failed');
    }
  };

  const handleCalendarRename = async () => {
    if (!calendarId || !selectedCalendar) {
      return;
    }

    const nextName = window.prompt('New calendar name', selectedCalendar.name)?.trim();
    if (!nextName) {
      return;
    }

    try {
      await updateCalendar(calendarId, nextName, selectedCalendar.description);
      toast.success('Calendar updated');
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Calendar update failed');
    }
  };

  const handleCalendarDelete = async () => {
    if (!calendarId) {
      return;
    }

    const shouldDelete = window.confirm('Delete selected calendar?');
    if (!shouldDelete) {
      return;
    }

    try {
      await deleteCalendar(calendarId);
      toast.success('Calendar deleted');
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Calendar delete failed');
    }
  };

  const handleEventDrop = async (arg: EventDropArg) => {
    const source = arg.event.extendedProps.source as GroupCalendarEvent | undefined;
    if (!source) {
      arg.revert();
      return;
    }

    if (!arg.event.start) {
      arg.revert();
      return;
    }

    const nextStart = arg.event.start.toISOString();
    const nextEnd = arg.event.end ? arg.event.end.toISOString() : nextStart;

    try {
      await moveEvent(source, nextStart, nextEnd);
      toast.success('Event moved');
    } catch (reason) {
      arg.revert();
      toast.error(reason instanceof Error ? reason.message : 'Move failed');
    }
  };

  const handleEventDelete = async () => {
    if (!selectedEvent) {
      return;
    }

    const shouldDelete = window.confirm('Delete this event?');
    if (!shouldDelete) {
      return;
    }

    try {
      await deleteEvent(selectedEvent);
      setEventModalOpen(false);
      setSelectedEvent(null);
      toast.success('Event deleted');
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Delete failed');
    }
  };

  return (
    <div className="space-y-4">
      <div className="surface rounded-xl p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid min-w-52 gap-1">
            <label className="text-xs text-slate-400">Group</label>
            <select
              value={groupId}
              onChange={(evt) => setGroupId(evt.target.value)}
              className="rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 text-sm"
              disabled={Boolean(initialGroupId)}
            >
              <option value="">Select group</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid min-w-52 gap-1">
            <label className="text-xs text-slate-400">Calendar</label>
            <select
              value={calendarId}
              onChange={(evt) => setCalendarId(evt.target.value)}
              className="rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 text-sm"
            >
              <option value="">Select calendar</option>
              {calendars.map((calendar) => (
                <option key={calendar.id} value={calendar.id}>
                  {calendar.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid min-w-40 gap-1">
            <label className="text-xs text-slate-400">Scope filter</label>
            <select
              value={scopeFilter}
              onChange={(evt) => setScopeFilter(evt.target.value as 'all' | 'group' | 'global')}
              className="rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 text-sm"
            >
              <option value="all">All</option>
              <option value="group">Group</option>
              <option value="global">Global</option>
            </select>
          </div>

          <label className="mb-2 inline-flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={includeCancelled}
              onChange={(evt) => setIncludeCancelled(evt.target.checked)}
            />
            Include cancelled
          </label>

          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void refetch()} startIcon={<RefreshCw size={16} />}>
              Refresh
            </Button>
            <Button variant="secondary" onClick={() => setCalendarModalOpen(true)} startIcon={<CalendarPlus size={16} />}>
              New calendar
            </Button>
            <Button variant="secondary" onClick={handleCalendarRename} startIcon={<Pencil size={16} />}>
              Rename calendar
            </Button>
            <Button variant="danger" onClick={handleCalendarDelete} startIcon={<Trash2 size={16} />}>
              Delete calendar
            </Button>
            <Button onClick={handleEventCreate}>New event</Button>
          </div>
        </div>

        {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
      </div>

      <div className="surface rounded-xl p-4">
        <FullCalendar
          locale={locale}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          height="auto"
          editable
          selectable
          events={eventItems}
          dateClick={(arg) => {
            setClickedDate(arg.date);
            handleEventCreate();
          }}
          eventClick={(arg) => {
            const source = arg.event.extendedProps.source as GroupCalendarEvent | undefined;
            if (!source) {
              return;
            }
            handleEventEdit(source);
          }}
          eventDrop={(arg) => {
            void handleEventDrop(arg);
          }}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
          }}
          buttonText={{
            today: t('today'),
            month: t('month'),
            week: t('week'),
            day: t('day')
          }}
        />
      </div>

      <EventModal
        open={eventModalOpen}
        mode={eventModalMode}
        event={selectedEvent}
        defaultStart={clickedDate}
        submitting={saving}
        onClose={() => {
          setEventModalOpen(false);
          setSelectedEvent(null);
        }}
        onSubmit={async ({scope, data}) => {
          try {
            await upsertEvent({
              scope: (selectedEvent?.isGlobal ? 'global' : scope) as CalendarScope,
              eventId: selectedEvent?.id,
              data
            });
            toast.success(eventModalMode === 'create' ? 'Event created' : 'Event updated');
            setEventModalOpen(false);
            setSelectedEvent(null);
          } catch (reason) {
            toast.error(reason instanceof Error ? reason.message : 'Save failed');
          }
        }}
      />

      {eventModalMode === 'edit' && selectedEvent ? (
        <div className="flex justify-end">
          <Button variant="danger" onClick={handleEventDelete} disabled={saving} startIcon={<Trash2 size={16} />}>
            Delete event
          </Button>
        </div>
      ) : null}

      <ModalCalendar
        open={calendarModalOpen}
        saving={saving}
        name={calendarName}
        description={calendarDescription}
        onNameChange={setCalendarName}
        onDescriptionChange={setCalendarDescription}
        onClose={() => setCalendarModalOpen(false)}
        onSubmit={handleCalendarCreate}
      />

      {loading ? <div className="text-sm text-slate-400">Loading...</div> : null}
    </div>
  );
}

interface ModalCalendarProps {
  open: boolean;
  saving: boolean;
  name: string;
  description: string;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => Promise<void>;
}

function ModalCalendar({
  open,
  saving,
  name,
  description,
  onNameChange,
  onDescriptionChange,
  onClose,
  onSubmit
}: ModalCalendarProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-5">
        <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">New calendar</h2>
        <form className="grid gap-3" onSubmit={(event) => void onSubmit(event)}>
          <div className="grid gap-1">
            <label className="text-sm text-slate-300">Calendar name</label>
            <input
              className="w-full rounded-md border border-[var(--border-default)] bg-[#0f0f18] px-3 py-2"
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              required
            />
          </div>
          <div className="grid gap-1">
            <label className="text-sm text-slate-300">Description</label>
            <textarea
              className="w-full rounded-md border border-[var(--border-default)] bg-[#0f0f18] px-3 py-2"
              rows={3}
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Create'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
