'use client';

import {CalendarPlus2, Pencil, Trash2} from 'lucide-react';
import Button from '@/components/ui/Button';
import type {CalendarCopy, GroupCalendarItem} from '../types';

interface CalendarSelectorProps {
  copy: CalendarCopy;
  calendars: GroupCalendarItem[];
  activeCalendarId: string;
  canManageCalendars: boolean;
  isBusy: boolean;
  onSelect: (calendarId: string) => void;
  onCreate: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function CalendarSelector({
  copy,
  calendars,
  activeCalendarId,
  canManageCalendars,
  isBusy,
  onSelect,
  onCreate,
  onEdit,
  onDelete
}: CalendarSelectorProps) {
  if (calendars.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-tertiary)]">{copy.calendarLabel}</p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">{copy.selectCalendar}</h2>
        </div>

        {canManageCalendars ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={onCreate}
              disabled={isBusy}
              startIcon={<CalendarPlus2 size={16} strokeWidth={1.75} />}
            >
              {copy.createCalendar}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={onEdit}
              disabled={isBusy || !activeCalendarId}
              startIcon={<Pencil size={16} strokeWidth={1.75} />}
            >
              {copy.editCalendar}
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={onDelete}
              disabled={isBusy || !activeCalendarId}
              startIcon={<Trash2 size={16} strokeWidth={1.75} />}
            >
              {copy.deleteCalendar}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="md:hidden">
        <select
          value={activeCalendarId}
          onChange={(event) => onSelect(event.target.value)}
          disabled={isBusy}
          className="h-[var(--input-height)] w-full rounded-[var(--input-radius)] border border-[var(--border-default)] bg-[var(--bg-input)] px-3 text-sm"
        >
          {calendars.map((calendar) => (
            <option key={calendar.id} value={calendar.id}>
              {calendar.name}
            </option>
          ))}
        </select>
      </div>

      <div className="hidden flex-wrap gap-2 md:flex">
        {calendars.map((calendar) => {
          const isActive = calendar.id === activeCalendarId;

          return (
            <button
              key={calendar.id}
              type="button"
              onClick={() => onSelect(calendar.id)}
              disabled={isBusy}
              className={[
                'rounded-full border px-4 py-2 text-sm font-medium',
                isActive
                  ? 'border-[var(--accent-border)] bg-[var(--accent-subtle)] text-[var(--text-primary)]'
                  : 'border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]'
              ].join(' ')}
            >
              {calendar.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
