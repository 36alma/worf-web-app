'use client';

import {useState} from 'react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Modal from '@/components/ui/Modal';
import type {CalendarCopy, GroupCalendarEventItem} from '../types';
import {formatEventDate} from '../utils/calendarMappers';

interface EventViewModalProps {
  open: boolean;
  locale: string;
  copy: CalendarCopy;
  event: GroupCalendarEventItem | null;
  canManageEvents: boolean;
  isDeleting: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => Promise<void>;
}

export default function EventViewModal({
  open,
  locale,
  copy,
  event,
  canManageEvents,
  isDeleting,
  onClose,
  onEdit,
  onDelete
}: EventViewModalProps) {
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  if (!event) {
    return null;
  }

  return (
    <>
      <Modal
        open={open}
        title={copy.eventDetails}
        badge={event.isCancelled ? <Badge color="red">{copy.deletedEventLabel}</Badge> : null}
        onClose={onClose}
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-tertiary)]">{copy.eventName}</p>
            <h3 className="text-xl font-semibold text-[var(--text-primary)]">{event.name}</h3>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-tertiary)]">{copy.eventKind}</p>
              <p className="text-sm text-[var(--text-primary)]">{copy.kindLabels[event.kind]}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-tertiary)]">{copy.eventTimezone}</p>
              <p className="text-sm text-[var(--text-primary)]">{event.timezone ?? copy.emptyValue}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-tertiary)]">{copy.eventStart}</p>
              <p className="text-sm text-[var(--text-primary)]">
                {formatEventDate(event.startAt, locale, event.timezone) || copy.emptyValue}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-tertiary)]">{copy.eventEnd}</p>
              <p className="text-sm text-[var(--text-primary)]">
                {formatEventDate(event.endAt, locale, event.timezone) || copy.emptyValue}
              </p>
            </div>
            <div className="space-y-1 md:col-span-2">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-tertiary)]">{copy.eventLocation}</p>
              <p className="text-sm text-[var(--text-primary)]">{event.location ?? copy.emptyValue}</p>
            </div>
          </div>

          {canManageEvents ? (
            <div className="flex justify-end gap-2 border-t border-[var(--border-default)] pt-4">
              <Button type="button" variant="secondary" onClick={onEdit} disabled={isDeleting}>
                {copy.editEvent}
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={() => setConfirmDeleteOpen(true)}
                disabled={isDeleting}
              >
                {copy.deleteEvent}
              </Button>
            </div>
          ) : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDeleteOpen}
        title={copy.deleteEvent}
        message={copy.deleteEventPrompt}
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={async () => {
          await onDelete();
          setConfirmDeleteOpen(false);
        }}
        cancelLabel={copy.cancel}
        confirmLabel={copy.confirm}
      />
    </>
  );
}
