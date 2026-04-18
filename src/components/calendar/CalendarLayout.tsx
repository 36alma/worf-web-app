/** Main calendar layout with sidebar, calendar grid and event list sections. */
'use client';

import { useMemo } from 'react';
import { useCalendars } from '@/src/hooks/useCalendars';
import { useEvents } from '@/src/hooks/useEvents';
import { useDeleteEvent } from '@/src/hooks/useDeleteEvent';
import { useUpdateEvent } from '@/src/hooks/useUpdateEvent';
import CalendarList from '@/src/components/calendar/CalendarList';
import CalendarView from '@/src/components/calendar/CalendarView';
import EventList from '@/src/components/calendar/EventList';
import ErrorBoundary from '@/src/components/ui/ErrorBoundary';

/**
 * Props for top-level calendar page layout.
 */
export interface CalendarLayoutProps {
  groupId: string;
  canWrite?: boolean;
}

export default function CalendarLayout({ groupId, canWrite = true }: CalendarLayoutProps) {
  const { selectedCalendarId } = useCalendars(groupId);
  const { events } = useEvents(groupId, selectedCalendarId ?? '', {});
  const deleteEvent = useDeleteEvent();
  const updateEvent = useUpdateEvent();

  const currentCalendarId = selectedCalendarId ?? '';
  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => (a.startAt ?? '').localeCompare(b.startAt ?? '')),
    [events]
  );

  return (
    <ErrorBoundary>
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <CalendarList groupId={groupId} canWrite={canWrite} />
        <div className="grid gap-4">
          {currentCalendarId ? (
            <>
              <CalendarView groupId={groupId} calendarId={currentCalendarId} canWrite={canWrite} />
              <EventList
                events={sortedEvents}
                canWrite={canWrite}
                onEdit={(event) => {
                  const nextName = window.prompt('Esemény név', event.name)?.trim();
                  if (!nextName) return;
                  void updateEvent({
                    groupId,
                    calendarId: currentCalendarId,
                    eventId: event.id,
                    isGlobal: event.isGlobal,
                    updates: { kind: event.kind, name: nextName }
                  });
                }}
                onDelete={(event) => {
                  const shouldDelete = window.confirm('Biztosan törlöd az eseményt?');
                  if (!shouldDelete) return;
                  void deleteEvent({
                    groupId,
                    calendarId: currentCalendarId,
                    eventId: event.id,
                    isGlobal: event.isGlobal
                  });
                }}
              />
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] p-8 text-center text-sm text-[var(--text-secondary)]">
              Válassz vagy hozz létre naptárat a folytatáshoz.
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}
