/** Event list view with quick filters and edit/delete actions. */
'use client';

import { useMemo, useState } from 'react';
import type { GroupCalendarEvent } from '@/src/types/calendar.types';
import { formatDate, isEventUpcoming } from '@/src/utils/dateUtils';
import Button from '@/src/components/ui/Button';

type FilterMode = 'all' | 'upcoming' | 'past' | 'cancelled';

/**
 * Props for tabular event listing.
 */
export interface EventListProps {
  events: GroupCalendarEvent[];
  onEdit: (event: GroupCalendarEvent) => void;
  onDelete: (event: GroupCalendarEvent) => void;
  canWrite?: boolean;
}

export default function EventList({ events, onEdit, onDelete, canWrite = true }: EventListProps) {
  const [filter, setFilter] = useState<FilterMode>('all');

  const filtered = useMemo(() => {
    if (filter === 'cancelled') return events.filter((event) => event.isCancelled);
    if (filter === 'upcoming') return events.filter((event) => isEventUpcoming(event) && !event.isCancelled);
    if (filter === 'past') return events.filter((event) => event.startAt && !isEventUpcoming(event) && !event.isCancelled);
    return events;
  }, [events, filter]);

  return (
    <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="mr-auto text-sm font-semibold">Esemény lista</h3>
        <Button className="p-2" variant={filter === 'all' ? 'primary' : 'ghost'} onClick={() => setFilter('all')}>
          Mind
        </Button>
        <Button className="p-2" variant={filter === 'upcoming' ? 'primary' : 'ghost'} onClick={() => setFilter('upcoming')}>
          Közelgő
        </Button>
        <Button className="p-2" variant={filter === 'past' ? 'primary' : 'ghost'} onClick={() => setFilter('past')}>
          Múlt
        </Button>
        <Button className="p-2" variant={filter === 'cancelled' ? 'primary' : 'ghost'} onClick={() => setFilter('cancelled')}>
          Törölt
        </Button>
      </div>

      {filtered.length === 0 ? <div className="rounded-md border border-dashed border-[var(--border-default)] p-3 text-sm text-[var(--text-secondary)]">Nincs esemény a szűrőhöz.</div> : null}

      <div className="grid gap-2">
        {filtered.map((event) => (
          <article key={event.id} className="grid gap-2 rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <h4 className="font-medium">{event.name}</h4>
              <p className="text-xs text-[var(--text-secondary)]">
                {formatDate(event.startAt ?? '')} {event.endAt ? `- ${formatDate(event.endAt)}` : ''}
              </p>
              {event.location ? <p className="text-xs text-[var(--text-secondary)]">{event.location}</p> : null}
            </div>
            {canWrite && (
              <div className="flex items-center gap-2">
                <Button className="p-2" variant="secondary" onClick={() => onEdit(event)}>
                  Szerkesztés
                </Button>
                <Button className="p-2" variant="danger" onClick={() => onDelete(event)}>
                  Törlés
                </Button>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
