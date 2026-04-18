/** Event create/edit modal using React Hook Form + Zod validation. */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import Modal from '@/src/components/ui/Modal';
import Button from '@/src/components/ui/Button';
import RecurringEventHandler from '@/src/components/calendar/RecurringEventHandler';
import type { GroupCalendarEvent, RecurringScope } from '@/src/types/calendar.types';
import { validateEventDates } from '@/src/utils/dateUtils';

export const EventSchema = z
  .object({
    kind: z.string().min(1),
    name: z.string().min(1, 'Az esemény neve kötelező'),
    location: z.string().optional(),
    all_day: z.boolean(),
    start_at: z.string().optional(),
    end_at: z.string().optional(),
    rrule: z.string().optional(),
    timezone: z.string().optional()
  })
  .refine((value) => validateEventDates(value.start_at, value.end_at), {
    message: 'A kezdés nem lehet később, mint a befejezés',
    path: ['end_at']
  });

type EventFormValues = z.infer<typeof EventSchema>;

/**
 * Props for event modal create/edit interactions.
 */
export interface EventModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialEvent?: GroupCalendarEvent | null;
  onClose: () => void;
  onSave: (payload: EventFormValues, recurringScope: RecurringScope) => Promise<void>;
  onDelete?: () => Promise<void>;
  submitting?: boolean;
}

export default function EventModal({ open, mode, initialEvent, onClose, onSave, onDelete, submitting = false }: EventModalProps) {
  const [recurringScope, setRecurringScope] = useState<RecurringScope>('single');
  const isEdit = mode === 'edit';

  const defaults = useMemo<EventFormValues>(
    () => ({
      kind: initialEvent?.kind ?? 'event',
      name: initialEvent?.name ?? '',
      location: initialEvent?.location ?? '',
      all_day: initialEvent?.allDay ?? false,
      start_at: initialEvent?.startAt ?? '',
      end_at: initialEvent?.endAt ?? '',
      rrule: initialEvent?.rrule ?? '',
      timezone: initialEvent?.timezone ?? 'Europe/Budapest'
    }),
    [initialEvent]
  );

  const form = useForm<EventFormValues>({
    resolver: zodResolver(EventSchema),
    defaultValues: defaults
  });

  useEffect(() => {
    if (open) {
      form.reset(defaults);
    }
  }, [defaults, form, open]);

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Esemény szerkesztése' : 'Új esemény'}>
      <form
        className="grid gap-3"
        onSubmit={form.handleSubmit(async (values) => {
          await onSave(values, recurringScope);
        })}
      >
        <div className="grid gap-1">
          <label className="text-sm text-[var(--text-secondary)]">Név</label>
          <input aria-label="Event name" className="rounded-md border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2" {...form.register('name')} />
          {form.formState.errors.name ? <p className="text-xs text-red-300">{form.formState.errors.name.message}</p> : null}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="grid gap-1">
            <label className="text-sm text-[var(--text-secondary)]">Kategória</label>
            <input aria-label="Event kind" className="rounded-md border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2" {...form.register('kind')} />
          </div>
          <div className="grid gap-1">
            <label className="text-sm text-[var(--text-secondary)]">Helyszín</label>
            <input aria-label="Event location" className="rounded-md border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2" {...form.register('location')} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="grid gap-1">
            <label className="text-sm text-[var(--text-secondary)]">Kezdés (ISO-8601)</label>
            <input aria-label="Event start" className="rounded-md border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2" placeholder="2026-04-07T09:00:00Z" {...form.register('start_at')} />
          </div>
          <div className="grid gap-1">
            <label className="text-sm text-[var(--text-secondary)]">Befejezés (ISO-8601)</label>
            <input aria-label="Event end" className="rounded-md border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2" placeholder="2026-04-07T10:00:00Z" {...form.register('end_at')} />
            {form.formState.errors.end_at ? <p className="text-xs text-red-300">{form.formState.errors.end_at.message}</p> : null}
          </div>
        </div>

        <div className="grid gap-1">
          <label className="text-sm text-[var(--text-secondary)]">Ismétlődés (RRULE)</label>
          <input aria-label="Event rrule" className="rounded-md border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2" placeholder="FREQ=WEEKLY;BYDAY=MO" {...form.register('rrule')} />
        </div>

        <div className="grid gap-1">
          <label className="text-sm text-[var(--text-secondary)]">Időzóna</label>
          <input aria-label="Event timezone" className="rounded-md border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2" {...form.register('timezone')} />
        </div>

        <label className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <input aria-label="All day event" type="checkbox" {...form.register('all_day')} />
          Egész napos esemény
        </label>

        {isEdit && initialEvent?.rrule ? <RecurringEventHandler value={recurringScope} onChange={setRecurringScope} /> : null}

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          {isEdit && onDelete ? (
            <Button variant="danger" type="button" onClick={() => void onDelete()} className="p-2">
              Törlés
            </Button>
          ) : null}
          <Button variant="secondary" type="button" onClick={onClose} className="p-2">
            Mégse
          </Button>
          <Button type="submit" className="p-2" disabled={submitting}>
            {submitting ? 'Mentés...' : 'Mentés'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
