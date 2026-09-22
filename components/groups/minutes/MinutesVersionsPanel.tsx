'use client';

import {useCallback, useEffect, useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useLocale, useTranslations} from 'next-intl';
import {History} from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import MinutesStatusBadge from './MinutesStatusBadge';
import MinutesArchivedBadge from './MinutesArchivedBadge';
import {formatDateTime} from './minutesDates';
import type {MeetingMinutes} from './types';
import {getMinutesVersions, restoreMinutesVersion} from '@/lib/api/minutes';
import {translateMinutesApiError} from '@/lib/i18n/minutes';
import {countWarnings} from './witnessIssues';

export interface MinutesVersionsPanelProps {
  groupId: string;
  minutesId: string;
  /** Re-fetch when the viewed record changes state (e.g. after a vote). */
  status: string;
  /** `group.minutes.modify` — required for "restore as a new version". */
  canModify?: boolean;
}

/**
 * The version chain of a minutes (newest first). A witness should vote on the highest version; an archived
 * one can be brought back with `restore`, which never overwrites anything — it opens a new `DRAFT` copy
 * (`max(version) + 1`) of the archived content.
 */
export default function MinutesVersionsPanel({groupId, minutesId, status, canModify}: MinutesVersionsPanelProps) {
  const t = useTranslations('group_minutes');
  const locale = useLocale();
  const router = useRouter();
  const [versions, setVersions] = useState<MeetingMinutes[]>([]);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getMinutesVersions({group_id: groupId, minutes_id: minutesId})
      .then(({data}) => mounted && setVersions((data as {versions?: MeetingMinutes[]}).versions ?? []))
      .catch(() => mounted && setVersions([]));
    return () => {
      mounted = false;
    };
  }, [groupId, minutesId, status]);

  const handleRestore = useCallback(
    async (sourceId: string) => {
      setRestoring(sourceId);
      try {
        const {data} = await restoreMinutesVersion({group_id: groupId, minutes_id: sourceId});
        const newId = (data as {new_minutes_id: string}).new_minutes_id;
        toast.success(t('versions.restored_toast'));
        // The copy is made either way; `warnings` only says that witnesses copied over are no longer eligible.
        const warnings = countWarnings(data);
        if (warnings > 0) toast(t('state.warnings_toast', {count: warnings}), {icon: '⚠️', duration: 8000});
        router.push(`/${locale}/groups/${encodeURIComponent(groupId)}/minutes/${encodeURIComponent(newId)}`);
      } catch (error) {
        toast.error(translateMinutesApiError(t, error, 'errors.default'));
      } finally {
        setRestoring(null);
      }
    },
    [groupId, locale, router, t]
  );

  if (versions.length < 2) return null;

  const latest = versions.reduce((a, b) => (b.version > a.version ? b : a));
  // Two open versions cannot exist at once — `restore` is refused while one is in progress.
  const inProgress = versions.find((v) => v.status === 'DRAFT' || v.status === 'PENDING_APPROVAL') ?? null;
  const approved = versions.find((v) => v.status === 'APPROVED') ?? null;

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border-default)] p-4">
      <h2 className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
        <History className="h-4 w-4 text-[var(--text-tertiary)]" />
        {t('versions.title')}
      </h2>
      {latest.id !== minutesId && (
        <p className="text-sm text-amber-700 dark:text-amber-300">{t('versions.not_latest', {version: latest.version})}</p>
      )}
      <ul className="space-y-1.5">
        {versions.map((v) => {
          const isCurrentView = v.id === minutesId;
          // Superseded (`status: ARCHIVED`) versions can be brought back; one the user also archived (`archived_at`)
          // is read-only and `restore` refuses it (`archived_read_only`) until it is unarchived.
          const restorable = canModify && v.status === 'ARCHIVED';
          return (
            <li key={v.id} className="flex flex-wrap items-center gap-2 text-sm">
              <Link
                href={`/${locale}/groups/${encodeURIComponent(groupId)}/minutes/${encodeURIComponent(v.id)}`}
                className={
                  isCurrentView
                    ? 'font-semibold text-[var(--text-primary)]'
                    : 'text-[var(--text-primary)] underline-offset-2 hover:underline'
                }
              >
                {t('list.version_label', {version: v.version})}
              </Link>
              <MinutesStatusBadge status={v.status} />
              {v.archived_at && <MinutesArchivedBadge />}
              <span className="text-xs text-[var(--text-tertiary)]">{formatDateTime(v.updated_at, locale)}</span>
              {isCurrentView && <span className="text-xs text-[var(--text-tertiary)]">({t('versions.current')})</span>}
              {restorable && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  loading={restoring === v.id}
                  disabled={!!restoring || !!inProgress || !!v.archived_at}
                  title={inProgress ? t('versions.restore_blocked', {version: inProgress.version}) : undefined}
                  onClick={() => setConfirmId(v.id)}
                >
                  {t('versions.restore')}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {canModify && inProgress && (
        <p className="text-xs text-[var(--text-tertiary)]">{t('versions.restore_blocked', {version: inProgress.version})}</p>
      )}
      {canModify && versions.some((v) => v.status === 'ARCHIVED' && v.archived_at) && (
        <p className="text-xs text-[var(--text-tertiary)]">{t('versions.archived_hint')}</p>
      )}

      {confirmId && (
        <ConfirmDialog
          open
          title={t('versions.restore')}
          message={approved ? t('versions.restore_confirm_approved', {version: approved.version}) : t('versions.restore_confirm')}
          confirmLabel={t('versions.restore')}
          onCancel={() => setConfirmId(null)}
          onConfirm={() => {
            const id = confirmId;
            setConfirmId(null);
            if (id) void handleRestore(id);
          }}
        />
      )}
    </div>
  );
}
