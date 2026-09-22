'use client';

import {useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Skeleton from '@/components/ui/Skeleton';
import {getParticipantCalendarCandidates, confirmParticipantsFromEvent} from '@/lib/api/minutes';
import {translateMinutesApiError} from '@/lib/i18n/minutes';

export interface CalendarCandidate {
  user_id: string;
  username: string;
  full_name: string;
  invitation_status?: string | null;
  attended: boolean;
  already_participant: boolean;
}

export interface ParticipantCalendarImportModalProps {
  groupId: string;
  minutesId: string;
  calendarEventId: string;
  onClose: () => void;
  onConfirmed: (selectedUserIds: string[]) => void;
}

export default function ParticipantCalendarImportModal({
  groupId,
  minutesId,
  calendarEventId,
  onClose,
  onConfirmed
}: ParticipantCalendarImportModalProps) {
  const t = useTranslations('group_minutes');
  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState<CalendarCandidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getParticipantCalendarCandidates({group_id: groupId, minutes_id: minutesId, calendar_event_id: calendarEventId})
      .then(({data}) => {
        if (!mounted) return;
        const list = (data as {candidates?: CalendarCandidate[]}).candidates ?? [];
        setCandidates(list);
        setSelected(new Set(list.filter((c) => c.already_participant || c.attended).map((c) => c.user_id)));
      })
      .catch((error) => {
        if (!mounted) return;
        toast.error(translateMinutesApiError(t, error, 'errors.default'));
        onClose();
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, minutesId, calendarEventId]);

  const toggle = (userId: string, alreadyParticipant: boolean) => {
    if (alreadyParticipant) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      const selectedUserIds = Array.from(selected);
      const {data} = await confirmParticipantsFromEvent({
        group_id: groupId,
        minutes_id: minutesId,
        selected_user_ids: selectedUserIds
      });
      const participantIds = (data as {participant_ids?: string[]}).participant_ids ?? [];
      if (participantIds.length > 0) {
        toast.success(t('participants.import_success'));
      }
      onConfirmed(selectedUserIds);
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open title={t('participants.import_from_event')} onClose={onClose}>
      <div className="space-y-3">
        {loading && <Skeleton className="h-40 w-full" />}

        {!loading && candidates.length === 0 && (
          <p className="text-sm text-[var(--text-secondary)]">{t('participants.import_empty')}</p>
        )}

        {!loading && candidates.length > 0 && (
          <ul className="max-h-80 space-y-1 overflow-y-auto">
            {candidates.map((c) => (
              <li key={c.user_id} className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] px-3 py-2">
                <input
                  type="checkbox"
                  checked={selected.has(c.user_id)}
                  disabled={c.already_participant}
                  onChange={() => toggle(c.user_id, c.already_participant)}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-[var(--text-primary)]">{c.full_name || c.username}</div>
                  {c.already_participant && (
                    <div className="text-xs text-[var(--text-secondary)]">{t('participants.already_added')}</div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            {t('form.cancel')}
          </Button>
          <Button variant="primary" onClick={handleConfirm} disabled={submitting || loading}>
            {t('participants.import_confirm')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
