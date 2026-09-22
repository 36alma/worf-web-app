'use client';

import {useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {Check, X} from 'lucide-react';
import Button from '@/components/ui/Button';
import WitnessVoteModal, {type WitnessDecision} from './WitnessVoteModal';
import {formatDateTime} from './minutesDates';
import type {WitnessState} from './witness';

export interface WitnessVoteBarProps {
  groupId: string;
  minutesId: string;
  subject: string;
  version: number;
  state: WitnessState;
  onVoted: () => void;
}

/**
 * The Approve / Reject call to action. Renders only for someone who can actually vote
 * (`state.canVote`: awaiting approval + own WITNESS record + `group.minutes.approve`).
 */
export default function WitnessVoteBar({groupId, minutesId, subject, version, state, onVoted}: WitnessVoteBarProps) {
  const t = useTranslations('group_minutes');
  const locale = useLocale();
  const [decision, setDecision] = useState<WitnessDecision | null>(null);

  // `canVote` comes from the server's `viewer` block when there is one, so the caller's own participant row
  // (`state.self`) is not required here — it only carries the "you approved at …" timestamp.
  if (!state.canVote) return null;

  const alreadyApproved = state.myApprovalStatus === 'APPROVED';
  const approvedDate = formatDateTime(state.self?.approved_at, locale);

  return (
    <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="font-semibold text-[var(--text-primary)]">{t('witness.awaiting_you')}</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            {alreadyApproved ? t('witness.already_approved', {date: approvedDate}) : t('witness.awaiting_you_hint')}
          </p>
          <p className="text-xs text-[var(--text-tertiary)]">
            {t('witness.progress', {approved: state.approvedCount, total: state.witnesses.length})}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {!alreadyApproved && (
            <Button variant="primary" startIcon={<Check className="h-4 w-4" />} onClick={() => setDecision('APPROVE')}>
              {t('witness.approve')}
            </Button>
          )}
          <Button variant="secondary" startIcon={<X className="h-4 w-4" />} onClick={() => setDecision('REJECT')}>
            {t('witness.reject')}
          </Button>
        </div>
      </div>

      <WitnessVoteModal
        decision={decision}
        groupId={groupId}
        minutesId={minutesId}
        subject={subject}
        version={version}
        onClose={() => setDecision(null)}
        onVoted={onVoted}
      />
    </div>
  );
}
