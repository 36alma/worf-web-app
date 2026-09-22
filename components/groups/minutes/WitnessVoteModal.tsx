'use client';

import {useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import toast from 'react-hot-toast';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import {Textarea} from '@/components/ui/Textarea';
import {castWitnessVote} from '@/lib/api/minutes';
import {translateMinutesApiError} from '@/lib/i18n/minutes';
import type {MinutesStatus} from './types';

export type WitnessDecision = 'APPROVE' | 'REJECT';

export interface WitnessVoteModalProps {
  /** The decision being confirmed; `null` keeps the modal closed. */
  decision: WitnessDecision | null;
  groupId: string;
  minutesId: string;
  subject: string;
  version: number;
  onClose: () => void;
  /** The vote was accepted (or the record turned out not to be awaiting approval any more) — reload the minutes. */
  onVoted: () => void;
}

/** Confirms an APPROVE, or collects the mandatory reason for a REJECT, then calls `witness/vote`. */
export default function WitnessVoteModal({decision, groupId, minutesId, subject, version, onClose, onVoted}: WitnessVoteModalProps) {
  const t = useTranslations('group_minutes');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (decision) setReason('');
  }, [decision]);

  if (!decision) return null;

  const isReject = decision === 'REJECT';
  const trimmedReason = reason.trim();
  const canSubmit = !busy && (!isReject || trimmedReason.length > 0);

  const close = () => {
    if (!busy) onClose();
  };

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      const {data} = await castWitnessVote({
        group_id: groupId,
        minutes_id: minutesId,
        decision,
        reason: isReject ? trimmedReason : undefined
      });
      const newStatus = (data as {status?: MinutesStatus} | undefined)?.status;
      if (isReject) toast.success(t('witness.rejected_toast'));
      else toast.success(t(newStatus === 'APPROVED' ? 'witness.finalized_toast' : 'witness.approved_toast'));
      onClose();
      onVoted();
    } catch (error) {
      const status = (error as {response?: {status?: number}} | undefined)?.response?.status;
      if (status === 403) {
        toast.error(t('witness.vote_forbidden'));
      } else if (status === 422) {
        toast.error(t('witness.vote_invalid_state'));
        onClose();
        onVoted();
      } else {
        toast.error(translateMinutesApiError(t, error, 'errors.default'));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open title={t(isReject ? 'witness.reject_title' : 'witness.approve_title')} onClose={close}>
      <div className="space-y-4">
        {isReject ? (
          <>
            <p className="text-sm text-[var(--text-secondary)]">{t('witness.reject_body')}</p>
            <div className="space-y-1.5">
              <label htmlFor="witness-reject-reason" className="text-sm font-medium text-[var(--text-primary)]">
                {t('witness.reject_reason_label')}
              </label>
              <Textarea
                id="witness-reject-reason"
                autoFocus
                rows={5}
                value={reason}
                disabled={busy}
                placeholder={t('witness.reject_reason_placeholder')}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </>
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">{t('witness.approve_body', {subject, version})}</p>
        )}

        <div className="flex justify-end gap-2 border-t border-[var(--border-default)] pt-4">
          <Button type="button" variant="ghost" disabled={busy} onClick={close}>
            {t('witness.cancel')}
          </Button>
          <Button
            type="button"
            variant={isReject ? 'danger' : 'primary'}
            loading={busy}
            disabled={!canSubmit}
            onClick={submit}
          >
            {t(isReject ? 'witness.confirm_reject' : 'witness.confirm_approve')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
