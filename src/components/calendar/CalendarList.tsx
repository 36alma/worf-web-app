/** Sidebar calendar list with create/select/update/delete actions. */
'use client';

import { useState, useCallback } from 'react';
import Skeleton from '@/components/ui/Skeleton';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Button from '@/src/components/ui/Button';
import { useCalendars } from '@/src/hooks/useCalendars';
import { useCalendar } from '@/src/hooks/useCalendar';
import Toast from '@/src/components/ui/Toast';

export interface CalendarListProps {
  groupId: string;
  canWrite?: boolean;
}

export default function CalendarList({ groupId, canWrite = true }: CalendarListProps) {
  const { calendars, selectedCalendarId, loading, setSelectedCalendar } = useCalendars(groupId);
  const { calendar, createCalendar, updateCalendar, deleteCalendar } = useCalendar(
    groupId,
    selectedCalendarId ?? undefined
  );

  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!canWrite || isSubmitting || !createName.trim()) return;

      setIsSubmitting(true);
      try {
        await createCalendar(createName.trim(), createDescription.trim() || null);
        setCreateName('');
        setCreateDescription('');
        Toast.success('Naptár létrehozva.');
      } catch (error) {
        console.error('Failed to create calendar:', error);
        // Silent policy: no error toast shown to user
      } finally {
        setIsSubmitting(false);
      }
    },
    [canWrite, isSubmitting, createName, createDescription, createCalendar]
  );

  const handleRename = useCallback(async () => {
    if (!canWrite || !calendar) return;

    const nextName = window.prompt('Naptár neve', calendar.name);
    if (!nextName?.trim()) return;

    try {
      await updateCalendar(nextName.trim(), calendar.description);
      Toast.success('Naptár frissítve.');
    } catch (error) {
      console.error('Failed to update calendar:', error);
    }
  }, [canWrite, calendar, updateCalendar]);

  const handleDelete = useCallback(async () => {
    if (!canWrite || !calendar) return;

    setDeleteConfirmOpen(false);
    try {
      await deleteCalendar();
      Toast.success('Naptár törölve.');
    } catch (error) {
      console.error('Failed to delete calendar:', error);
    }
  }, [canWrite, calendar, deleteCalendar]);

  return (
    <aside className="flex h-full flex-col rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
      {/* Header */}
      <div className="mb-3">
        <h2 className="text-base font-semibold">Naptárak</h2>
        <p className="text-xs text-[var(--text-secondary)]">Csoport naptárak kezelése</p>
      </div>

      {/* Create Form */}
      {canWrite && (
        <form className="mb-3 grid gap-2" onSubmit={handleCreateSubmit}>
          <input
            aria-label="Új naptár neve"
            type="text"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            placeholder="Új naptár neve"
            disabled={isSubmitting}
            className="rounded-md border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm disabled:opacity-50"
          />
          <input
            aria-label="Új naptár leírása"
            type="text"
            value={createDescription}
            onChange={(e) => setCreateDescription(e.target.value)}
            placeholder="Leírás (opcionális)"
            disabled={isSubmitting}
            className="rounded-md border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm disabled:opacity-50"
          />
          <Button
            type="submit"
            disabled={isSubmitting || !createName.trim()}
            className="p-2"
          >
            Új naptár
          </Button>
        </form>
      )}

      {/* Loading State */}
      {loading && (
        <div className="mb-3 grid gap-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      )}

      {/* Calendar List */}
      <div className="grid gap-2 overflow-auto">
        {!loading && calendars.length === 0 && (
          <div className="rounded-md border border-dashed border-[var(--border-default)] p-3 text-xs text-[var(--text-secondary)]">
            Nincs elérhető naptár.
          </div>
        )}
        {calendars.map((cal) => (
          <button
            key={cal.id}
            type="button"
            onClick={() => setSelectedCalendar(cal.id)}
            aria-label={`Naptár kiválasztása: ${cal.name}`}
            className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
              selectedCalendarId === cal.id
                ? 'border-[var(--accent)] bg-[var(--accent-dark)] text-[var(--text-primary)]'
                : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <div className="font-medium">{cal.name}</div>
            {cal.description && <div className="text-xs opacity-80">{cal.description}</div>}
          </button>
        ))}
      </div>

      {/* Action Buttons */}
      {canWrite && (
        <div className="mt-3 grid gap-2">
          <Button
            variant="secondary"
            disabled={!calendar}
            className="p-2"
            onClick={handleRename}
          >
            Naptár átnevezése
          </Button>
          <Button
            variant="danger"
            disabled={!calendar}
            className="p-2"
            onClick={() => setDeleteConfirmOpen(true)}
          >
            Naptár törlése
          </Button>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteConfirmOpen && canWrite}
        title="Naptár törlése"
        message="Biztosan törlöd a kiválasztott naptárat? Ez visszavonhatatlan."
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
      />
    </aside>
  );
}
