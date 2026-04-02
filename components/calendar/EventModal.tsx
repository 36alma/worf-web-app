'use client';

import {FormEvent, useEffect, useMemo, useState} from 'react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import type {CalendarScope, EventMutationFields, GroupCalendarEvent} from '@/lib/types/calendar';

interface EventFormSubmit {
  scope: CalendarScope;
  data: EventMutationFields & {
    kind: string;
    name: string;
  };
}

interface EventModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  event?: GroupCalendarEvent | null;
  defaultStart?: Date;
  onClose: () => void;
  onSubmit: (payload: EventFormSubmit) => Promise<void>;
  submitting?: boolean;
}

const toDateTimeLocal = (iso?: string) => {
  if (!iso) {
    return '';
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
};

const fromDateTimeLocal = (value: string): string | undefined => {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString();
};

export default function EventModal({
  open,
  mode,
  event,
  defaultStart,
  onClose,
  onSubmit,
  submitting = false
}: EventModalProps) {
  const isEdit = mode === 'edit';

  const [scope, setScope] = useState<CalendarScope>('group');
  const [kind, setKind] = useState('event');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [timezone, setTimezone] = useState('Europe/Budapest');
  const [rrule, setRrule] = useState('');
  const [untilAt, setUntilAt] = useState('');
  const [countN, setCountN] = useState('');
  const [parentId, setParentId] = useState('');
  const [originalStartAt, setOriginalStartAt] = useState('');
  const [isCancelled, setIsCancelled] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (event) {
      setScope(event.isGlobal ? 'global' : 'group');
      setKind(event.kind || 'event');
      setName(event.name || '');
      setLocation(event.location || '');
      setAllDay(event.allDay);
      setStartAt(toDateTimeLocal(event.startAt));
      setEndAt(toDateTimeLocal(event.endAt));
      setTimezone(event.timezone || 'Europe/Budapest');
      setRrule(event.rrule || '');
      setUntilAt(toDateTimeLocal(event.untilAt));
      setCountN(event.countN != null ? String(event.countN) : '');
      setParentId(event.parentId || '');
      setOriginalStartAt(toDateTimeLocal(event.originalStartAt));
      setIsCancelled(event.isCancelled);
      return;
    }

    const initial = defaultStart ?? new Date();
    const plusHour = new Date(initial.getTime() + 60 * 60 * 1000);
    setScope('group');
    setKind('event');
    setName('');
    setLocation('');
    setAllDay(false);
    setStartAt(toDateTimeLocal(initial.toISOString()));
    setEndAt(toDateTimeLocal(plusHour.toISOString()));
    setTimezone('Europe/Budapest');
    setRrule('');
    setUntilAt('');
    setCountN('');
    setParentId('');
    setOriginalStartAt('');
    setIsCancelled(false);
  }, [defaultStart, event, open]);

  const title = useMemo(() => (isEdit ? 'Edit event' : 'New event'), [isEdit]);

  const handleSubmit = async (submitEvent: FormEvent) => {
    submitEvent.preventDefault();

    const payload: EventMutationFields & {kind: string; name: string} = {
      kind,
      name,
      parent_id: parentId || undefined,
      location: location || undefined,
      all_day: allDay,
      start_at: fromDateTimeLocal(startAt),
      end_at: fromDateTimeLocal(endAt),
      rrule: rrule || undefined,
      until_at: fromDateTimeLocal(untilAt),
      count_n: countN ? Number(countN) : undefined,
      original_start_at: fromDateTimeLocal(originalStartAt),
      is_cancelled: isCancelled,
      timezone: timezone || undefined,
      is_global: scope === 'global'
    };

    await onSubmit({scope, data: payload});
  };

  return (
    <Modal open={open} title={title} onClose={onClose}>
      <form className="grid gap-3" onSubmit={handleSubmit}>
        <div className="grid gap-1">
          <label className="text-sm text-slate-300">Scope</label>
          <select
            className="w-full rounded-md border border-[var(--border)] bg-[#0f0f18] px-3 py-2"
            value={scope}
            onChange={(evt) => setScope(evt.target.value as CalendarScope)}
            disabled={isEdit}
          >
            <option value="group">Group</option>
            <option value="global">Global</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1">
            <label className="text-sm text-slate-300">Name</label>
            <input
              className="w-full rounded-md border border-[var(--border)] bg-[#0f0f18] px-3 py-2"
              value={name}
              onChange={(evt) => setName(evt.target.value)}
              required
            />
          </div>
          <div className="grid gap-1">
            <label className="text-sm text-slate-300">Kind</label>
            <input
              className="w-full rounded-md border border-[var(--border)] bg-[#0f0f18] px-3 py-2"
              value={kind}
              onChange={(evt) => setKind(evt.target.value)}
              required
            />
          </div>
        </div>

        <div className="grid gap-1">
          <label className="text-sm text-slate-300">Location</label>
          <input
            className="w-full rounded-md border border-[var(--border)] bg-[#0f0f18] px-3 py-2"
            value={location}
            onChange={(evt) => setLocation(evt.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1">
            <label className="text-sm text-slate-300">Start</label>
            <input
              type="datetime-local"
              className="w-full rounded-md border border-[var(--border)] bg-[#0f0f18] px-3 py-2"
              value={startAt}
              onChange={(evt) => setStartAt(evt.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <label className="text-sm text-slate-300">End</label>
            <input
              type="datetime-local"
              className="w-full rounded-md border border-[var(--border)] bg-[#0f0f18] px-3 py-2"
              value={endAt}
              onChange={(evt) => setEndAt(evt.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1">
            <label className="text-sm text-slate-300">Timezone</label>
            <input
              className="w-full rounded-md border border-[var(--border)] bg-[#0f0f18] px-3 py-2"
              value={timezone}
              onChange={(evt) => setTimezone(evt.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <label className="text-sm text-slate-300">Count</label>
            <input
              type="number"
              className="w-full rounded-md border border-[var(--border)] bg-[#0f0f18] px-3 py-2"
              value={countN}
              onChange={(evt) => setCountN(evt.target.value)}
              min={0}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1">
            <label className="text-sm text-slate-300">Until</label>
            <input
              type="datetime-local"
              className="w-full rounded-md border border-[var(--border)] bg-[#0f0f18] px-3 py-2"
              value={untilAt}
              onChange={(evt) => setUntilAt(evt.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <label className="text-sm text-slate-300">Original start</label>
            <input
              type="datetime-local"
              className="w-full rounded-md border border-[var(--border)] bg-[#0f0f18] px-3 py-2"
              value={originalStartAt}
              onChange={(evt) => setOriginalStartAt(evt.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1">
            <label className="text-sm text-slate-300">RRule</label>
            <input
              className="w-full rounded-md border border-[var(--border)] bg-[#0f0f18] px-3 py-2"
              value={rrule}
              onChange={(evt) => setRrule(evt.target.value)}
              placeholder="FREQ=WEEKLY;BYDAY=MO"
            />
          </div>
          <div className="grid gap-1">
            <label className="text-sm text-slate-300">Parent id</label>
            <input
              className="w-full rounded-md border border-[var(--border)] bg-[#0f0f18] px-3 py-2"
              value={parentId}
              onChange={(evt) => setParentId(evt.target.value)}
            />
          </div>
        </div>

        <label className="inline-flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={allDay} onChange={(evt) => setAllDay(evt.target.checked)} />
          All day
        </label>

        <label className="inline-flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={isCancelled} onChange={(evt) => setIsCancelled(evt.target.checked)} />
          Cancelled
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving...' : isEdit ? 'Save changes' : 'Create event'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
