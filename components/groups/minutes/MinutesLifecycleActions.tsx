'use client';

import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {useLocale, useTranslations} from 'next-intl';
import {Archive, ArchiveRestore, Trash2} from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import type {MinutesStatus} from './types';
import {archiveMinutes, deleteMinutes, unarchiveMinutes} from '@/lib/api/minutes';
import {translateMinutesApiError} from '@/lib/i18n/minutes';

export interface MinutesLifecycleActionsProps {
  groupId: string;
  minutesId: string;
  status: MinutesStatus;
  version: number;
  /** The record is one of several versions — `delete` only trashes this row, which the confirm says. */
  partOfChain: boolean;
  /** `archived_at != null`. */
  archived: boolean;
  /** `group.minutes.archive` */
  canArchive: boolean;
  /** `group.minutes.delete` */
  canDelete: boolean;
  /** Archived / unarchived — the page re-fetches. (A delete leaves the page for the list.) */
  onChanged: () => void;
}

type Pending = 'archive' | 'unarchive' | 'delete' | null;

const DONE_TOAST = {
  archive: 'archive.archived_toast',
  unarchive: 'archive.unarchived_toast',
  delete: 'delete.deleted_toast'
} as const;

/**
 * Archive / take out of the archive / move to the trash. `PENDING_APPROVAL` records can be neither archived nor
 * deleted (recall the finalization first), so the buttons are replaced by that hint there.
 */
export default function MinutesLifecycleActions({
  groupId,
  minutesId,
  status,
  version,
  partOfChain,
  archived,
  canArchive,
  canDelete,
  onChanged
}: MinutesLifecycleActionsProps) {
  const t = useTranslations('group_minutes');
  const router = useRouter();
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<Pending>(null);

  if (!canArchive && !canDelete) return null;

  if (status === 'PENDING_APPROVAL') {
    return <p className="max-w-xs text-right text-xs text-[var(--text-tertiary)]">{t('lifecycle.pending_hint')}</p>;
  }

  const run = async (action: Exclude<Pending, null>) => {
    setBusy(true);
    try {
      const body = {group_id: groupId, minutes_id: minutesId};
      if (action === 'archive') await archiveMinutes(body);
      if (action === 'unarchive') await unarchiveMinutes(body);
      if (action === 'delete') await deleteMinutes(body);
      toast.success(t(DONE_TOAST[action]));
      if (action === 'delete') {
        router.push(`/${locale}/groups/${encodeURIComponent(groupId)}/minutes`);
      } else {
        onChanged();
      }
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    } finally {
      setBusy(false);
    }
  };

  const runConfirmed = () => {
    const action = confirming;
    setConfirming(null);
    if (action) void run(action);
  };

  const copy: Record<Exclude<Pending, null>, {title: string; message: string; confirmLabel: string}> = {
    archive: {title: t('archive.action'), message: t('archive.confirm'), confirmLabel: t('archive.action')},
    unarchive: {title: t('archive.unarchive'), message: t('archive.unarchive_confirm'), confirmLabel: t('archive.unarchive')},
    delete: {
      title: t('delete.confirm_title'),
      message: partOfChain ? `${t('delete.confirm')} ${t('delete.confirm_version', {version})}` : t('delete.confirm'),
      confirmLabel: t('delete.action')
    }
  };

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {canArchive &&
        (archived ? (
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            startIcon={<ArchiveRestore className="h-4 w-4" />}
            onClick={() => setConfirming('unarchive')}
          >
            {t('archive.unarchive')}
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            startIcon={<Archive className="h-4 w-4" />}
            onClick={() => setConfirming('archive')}
          >
            {t('archive.action')}
          </Button>
        ))}
      {canDelete && (
        <Button
          variant="danger"
          size="sm"
          disabled={busy}
          startIcon={<Trash2 className="h-4 w-4" />}
          onClick={() => setConfirming('delete')}
        >
          {t('delete.action')}
        </Button>
      )}

      {confirming && (
        <ConfirmDialog
          open
          title={copy[confirming].title}
          message={copy[confirming].message}
          confirmLabel={copy[confirming].confirmLabel}
          onCancel={() => setConfirming(null)}
          onConfirm={runConfirmed}
        />
      )}
    </div>
  );
}
