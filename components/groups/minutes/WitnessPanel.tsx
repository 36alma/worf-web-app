'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import toast from 'react-hot-toast';
import Button from '@/components/ui/Button';
import {castWitnessVote} from '@/lib/api/minutes';
import {translateMinutesApiError} from '@/lib/i18n/minutes';
import type {MinutesParticipant, MinutesStatus} from './types';

export interface WitnessPanelProps {
  groupId: string;
  minutesId: string;
  status: MinutesStatus;
  participants: MinutesParticipant[];
  currentUserId: string | null;
  canApprove: boolean;
  onVoted: () => void;
}

export default function WitnessPanel({
  groupId,
  minutesId,
  status,
  participants,
  currentUserId,
  canApprove,
  onVoted
}: WitnessPanelProps) {
  const t = useTranslations('group_minutes');
  const [busy, setBusy] = useState(false);
  const witnesses = participants.filter((p) => p.role === 'WITNESS');

  if (witnesses.length === 0) return null;

  const approvedCount = witnesses.filter((w) => w.approval_status === 'APPROVED').length;
  const selfWitness = witnesses.find((w) => w.user_id === currentUserId);
  const canVote = status === 'PENDING_APPROVAL' && canApprove && !!selfWitness && selfWitness.approval_status === 'PENDING';

  const vote = async (decision: 'APPROVE' | 'REJECT') => {
    let reason: string | undefined;
    if (decision === 'REJECT') {
      reason = window.prompt(t('witness.reason_prompt')) ?? undefined;
      if (!reason) return;
    }
    setBusy(true);
    try {
      await castWitnessVote({group_id: groupId, minutes_id: minutesId, decision, reason});
      onVoted();
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border-default)] p-4">
      <h2 className="font-semibold text-[var(--text-primary)]">{t('witness.title')}</h2>
      <p className="text-sm text-[var(--text-secondary)]">
        {t('witness.progress', {approved: approvedCount, total: witnesses.length})}
      </p>
      <ul className="space-y-1 text-sm text-[var(--text-primary)]">
        {witnesses.map((w) => (
          <li key={w.id}>
            {w.user_id ?? w.display_name} — {w.approval_status ?? 'PENDING'}
          </li>
        ))}
      </ul>
      {canVote && (
        <div className="flex gap-2">
          <Button variant="primary" disabled={busy} onClick={() => vote('APPROVE')}>
            {t('witness.approve')}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => vote('REJECT')}>
            {t('witness.reject')}
          </Button>
        </div>
      )}
    </div>
  );
}
