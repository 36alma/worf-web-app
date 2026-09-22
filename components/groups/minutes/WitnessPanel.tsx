'use client';

import {useLocale, useTranslations} from 'next-intl';
import {AlertTriangle} from 'lucide-react';
import type {GroupUser} from '@/components/groups/tasks/types';
import type {ApprovalStatus, MinutesStatus} from './types';
import {participantName} from './participantName';
import type {WitnessState} from './witness';
import {NO_WITNESS_FLAGS, type WitnessFlags} from './witnessIssues';

export interface WitnessPanelProps {
  status: MinutesStatus;
  state: WitnessState;
  members: GroupUser[];
  /** Witnesses that are no longer eligible — they can never vote, so the approval is stuck on them. */
  witnessFlags?: WitnessFlags;
}

const STATUS_CLASSES: Record<ApprovalStatus, string> = {
  PENDING: 'text-[var(--text-tertiary)]',
  APPROVED: 'text-emerald-600 dark:text-emerald-400',
  REJECTED: 'text-red-600 dark:text-red-400'
};

function Warning({children}: {children: string}) {
  return (
    <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/** Who has to approve and how each witness voted. The vote buttons live in `WitnessVoteBar`. */
export default function WitnessPanel({status, state, members, witnessFlags = NO_WITNESS_FLAGS}: WitnessPanelProps) {
  const t = useTranslations('group_minutes');
  const locale = useLocale();
  const {witnesses, approvedCount, selfWithoutPermission, externalWitnesses} = state;

  if (witnesses.length === 0) return null;

  const awaiting = status === 'PENDING_APPROVAL';

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border-default)] p-4">
      <h2 className="font-semibold text-[var(--text-primary)]">{t('witness.title')}</h2>
      <p className="text-sm text-[var(--text-secondary)]">
        {t('witness.progress', {approved: approvedCount, total: witnesses.length})}
      </p>

      <ul className="space-y-1 text-sm text-[var(--text-primary)]">
        {witnesses.map((w) => {
          const approval: ApprovalStatus = w.approval_status ?? 'PENDING';
          const approvedAt = w.approved_at ? new Date(w.approved_at) : null;
          return (
            <li key={w.id} className="flex flex-wrap items-center gap-x-2">
              <span>{participantName(w, members, t('participants.unknown_name'))}</span>
              {!w.user_id && <span className="text-xs text-[var(--text-tertiary)]">({t('witness.external')})</span>}
              {witnessFlags.has(w.id) && (
                <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {t('witness.ineligible')}
                </span>
              )}
              <span className="text-[var(--text-tertiary)]">—</span>
              <span className={STATUS_CLASSES[approval]}>{t(`witness.status.${approval}`)}</span>
              {approval === 'APPROVED' && approvedAt && !Number.isNaN(approvedAt.getTime()) && (
                <span className="text-xs text-[var(--text-tertiary)]">{approvedAt.toLocaleString(locale)}</span>
              )}
            </li>
          );
        })}
      </ul>

      {awaiting && selfWithoutPermission && <Warning>{t('witness.no_permission_hint')}</Warning>}
      {awaiting && externalWitnesses.length > 0 && <Warning>{t('witness.external_warning')}</Warning>}
      {awaiting && witnessFlags.size > 0 && <Warning>{t('witness.stuck_hint', {count: witnessFlags.size})}</Warning>}
    </div>
  );
}
