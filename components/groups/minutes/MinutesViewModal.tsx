'use client';

import {useEffect, useState} from 'react';
import Link from 'next/link';
import {useLocale, useTranslations} from 'next-intl';
import {ExternalLink} from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Skeleton from '@/components/ui/Skeleton';
import MinutesStatusBadge from './MinutesStatusBadge';
import MinutesArchivedBadge from './MinutesArchivedBadge';
import MinutesTagChips from './MinutesTagChips';
import WitnessVoteBar from './WitnessVoteBar';
import type {MeetingMinutes} from './types';
import {getWitnessState, resolveCurrentUserId} from './witness';
import {useGroupMembers} from '@/hooks/useGroupMembers';
import {getMinutes} from '@/lib/api/minutes';
import {useAuthStore} from '@/lib/store/authStore';

export interface MinutesViewModalProps {
  open: boolean;
  groupId: string;
  minutesId: string;
  /** The user holds the modify permission — the Edit button also requires the minutes to still be a draft. */
  canModify?: boolean;
  /** The user holds `group.minutes.approve` — the vote buttons also require a WITNESS record on these minutes. */
  canApprove?: boolean;
  onClose: () => void;
  onEdit?: (minutes: MeetingMinutes) => void;
  /** The minutes could not be loaded (404/403/…) — the caller decides what to tell the user. */
  onLoadError?: (error: unknown) => void;
}

/** Summary of a meeting minutes record in a modal, with a shortcut to the full page. */
export default function MinutesViewModal({open, groupId, minutesId, canModify, canApprove, onClose, onEdit, onLoadError}: MinutesViewModalProps) {
  const t = useTranslations('group_minutes');
  const locale = useLocale();
  const [minutes, setMinutes] = useState<MeetingMinutes | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const authUser = useAuthStore((s) => s.user);
  // The member list is only needed to work out "who am I" when the profile carries no user id.
  const members = useGroupMembers(groupId, open && !!canApprove && !authUser?.id);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    // A reload after a vote refreshes in place instead of flashing the skeleton.
    if (reloadKey === 0) setLoading(true);
    getMinutes({group_id: groupId, minutes_id: minutesId})
      .then(({data}) => mounted && setMinutes((data as {minutes: MeetingMinutes}).minutes))
      .catch((error) => mounted && onLoadError?.(error))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, groupId, minutesId, reloadKey]);

  const pageHref = `/${locale}/groups/${encodeURIComponent(groupId)}/minutes/${encodeURIComponent(minutesId)}`;
  const meetingDate = minutes ? new Date(minutes.meeting_date) : null;
  const witnessState = minutes
    ? getWitnessState({
        status: minutes.status,
        participants: minutes.participants ?? [],
        currentUserId: resolveCurrentUserId(authUser, members),
        canApprove: !!canApprove,
        viewer: minutes.viewer
      })
    : null;

  return (
    <Modal open={open} title={minutes?.subject ?? t('list.title')} onClose={onClose}>
      {loading || !minutes ? (
        <div className="space-y-3">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <MinutesStatusBadge status={minutes.status} />
            {minutes.archived_at && <MinutesArchivedBadge />}
            <span className="text-xs text-[var(--text-tertiary)]">{t('list.version_label', {version: minutes.version})}</span>
          </div>

          <MinutesTagChips tags={minutes.tags} />

          <dl className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <dt className="text-xs uppercase tracking-[0.18em] text-[var(--text-tertiary)]">{t('form.meeting_date')}</dt>
              <dd className="text-sm text-[var(--text-primary)]">
                {meetingDate && !Number.isNaN(meetingDate.getTime()) ? meetingDate.toLocaleString(locale) : '—'}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs uppercase tracking-[0.18em] text-[var(--text-tertiary)]">{t('form.location')}</dt>
              <dd className="text-sm text-[var(--text-primary)]">{minutes.location || '—'}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs uppercase tracking-[0.18em] text-[var(--text-tertiary)]">{t('form.minute_taker')}</dt>
              <dd className="text-sm text-[var(--text-primary)]">
                {minutes.minute_taker_fullname?.trim() || t('form.minute_taker_missing')}
              </dd>
            </div>
          </dl>

          {minutes.rejection_reason && (
            <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
              {t('witness.rejection_reason', {reason: minutes.rejection_reason})}
            </p>
          )}

          {witnessState && witnessState.witnesses.length > 0 && minutes.status !== 'DRAFT' && (
            <p className="text-sm text-[var(--text-secondary)]">
              {t('witness.progress', {approved: witnessState.approvedCount, total: witnessState.witnesses.length})}
            </p>
          )}

          {witnessState && (
            <WitnessVoteBar
              groupId={groupId}
              minutesId={minutesId}
              subject={minutes.subject}
              version={minutes.version}
              state={witnessState}
              onVoted={() => setReloadKey((k) => k + 1)}
            />
          )}

          <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border-default)] pt-4">
            <Link
              href={pageHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-[var(--btn-height-md)] items-center gap-1.5 rounded-[var(--btn-radius)] border border-[var(--border-default)] px-[var(--btn-padding)] text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
            >
              <ExternalLink size={14} strokeWidth={1.75} />
              {t('editor.flow.open_page')}
            </Link>
            {canModify && minutes.status === 'DRAFT' && !minutes.archived_at && onEdit && (
              <Button type="button" variant="secondary" onClick={() => onEdit(minutes)}>
                {t('editor.entities.minutes.modify_title')}
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
