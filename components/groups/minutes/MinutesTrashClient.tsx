'use client';

import {useCallback, useEffect, useState} from 'react';
import Link from 'next/link';
import {useLocale, useTranslations} from 'next-intl';
import {ArrowLeft, Undo2} from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import Skeleton from '@/components/ui/Skeleton';
import MinutesArchivedBadge from './MinutesArchivedBadge';
import MinutesStatusBadge from './MinutesStatusBadge';
import MinutesTagChips from './MinutesTagChips';
import {formatDateTime} from './minutesDates';
import type {MinutesTrashResponse, TrashedMinutes} from './types';
import {useGroupMembers} from '@/hooks/useGroupMembers';
import {listMinutesTrash, restoreDeletedMinutes} from '@/lib/api/minutes';
import {extractMinutesErrorCode, translateMinutesApiError} from '@/lib/i18n/minutes';

const PAGE_SIZE = 20;

export interface MinutesTrashClientProps {
  groupId: string;
}

/**
 * The group's minutes trash (`group.minutes.delete`): most recently deleted first, each with the deadline until
 * which it can be restored. After the deadline the cleanup job deletes it for good.
 */
export default function MinutesTrashClient({groupId}: MinutesTrashClientProps) {
  const t = useTranslations('group_minutes');
  const locale = useLocale();
  const members = useGroupMembers(groupId);
  const [items, setItems] = useState<TrashedMinutes[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const {data} = await listMinutesTrash({group_id: groupId, page_number: 1, load_number: PAGE_SIZE});
      const payload = data as MinutesTrashResponse;
      setItems(payload.minutes ?? []);
      setTotal(payload.total_minutes ?? 0);
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    } finally {
      setLoading(false);
    }
  }, [groupId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      // Restoring removes rows locally, so "the next page" is derived from what is shown; rows already shown are
      // skipped when the page overlaps them.
      const page = Math.floor(items.length / PAGE_SIZE) + 1;
      const {data} = await listMinutesTrash({group_id: groupId, page_number: page, load_number: PAGE_SIZE});
      const payload = data as MinutesTrashResponse;
      setItems((current) => {
        const known = new Set(current.map((item) => item.id));
        return [...current, ...(payload.minutes ?? []).filter((item) => !known.has(item.id))];
      });
      setTotal(payload.total_minutes ?? 0);
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    } finally {
      setLoadingMore(false);
    }
  };

  const handleRestore = async (item: TrashedMinutes) => {
    setRestoringId(item.id);
    try {
      await restoreDeletedMinutes({group_id: groupId, minutes_id: item.id});
      toast.success(t('trash.restored_toast'));
      setItems((current) => current.filter((row) => row.id !== item.id));
      setTotal((current) => Math.max(0, current - 1));
    } catch (error) {
      // Here "in progress" means the chain already has a live version — the generic wording talks about finishing it.
      const message =
        extractMinutesErrorCode(error) === 'restore_version_in_progress'
          ? t('trash.restore_blocked')
          : translateMinutesApiError(t, error, 'errors.default');
      toast.error(message);
    } finally {
      setRestoringId(null);
    }
  };

  // `deleted_by_id` is the User-codec id — the same one the member list carries as `user_id`.
  const deletedBy = (item: TrashedMinutes): string =>
    members.find((m) => m.user_id === item.deleted_by_id)?.full_name?.trim() || t('participants.unknown_name');

  return (
    <section className="flex min-h-0 w-full flex-1 flex-col gap-4">
      <div className="space-y-2">
        <Link
          href={`/${locale}/groups/${encodeURIComponent(groupId)}/minutes`}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('trash.back')}
        </Link>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('trash.title')}</h1>
        <p className="text-sm text-[var(--text-secondary)]">{t('trash.intro')}</p>
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState>{t('trash.empty')}</EmptyState>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const expired = new Date(item.restorable_until).getTime() < Date.now();
            return (
              <li
                key={item.id}
                className="flex flex-col gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium text-[var(--text-primary)]">{item.subject}</span>
                    <MinutesStatusBadge status={item.status} />
                    {item.archived_at && <MinutesArchivedBadge />}
                  </div>
                  <div className="text-sm text-[var(--text-secondary)]">
                    {new Date(item.meeting_date).toLocaleDateString(locale)}
                    {item.version > 1 ? ` · ${t('list.version_label', {version: item.version})}` : ''}
                  </div>
                  <MinutesTagChips tags={item.tags} />
                  <div className="text-xs text-[var(--text-tertiary)]">
                    {t('trash.deleted_at', {date: formatDateTime(item.deleted_at, locale)})}
                    {item.deleted_by_id ? ` · ${t('trash.deleted_by', {name: deletedBy(item)})}` : ''}
                  </div>
                  <div
                    className={`text-xs ${expired ? 'text-red-600 dark:text-red-400' : 'text-[var(--text-tertiary)]'}`}
                  >
                    {t(expired ? 'trash.expired' : 'trash.restorable_until', {
                      date: formatDateTime(item.restorable_until, locale)
                    })}
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="shrink-0"
                  loading={restoringId === item.id}
                  disabled={!!restoringId}
                  startIcon={<Undo2 className="h-4 w-4" />}
                  onClick={() => void handleRestore(item)}
                >
                  {t('trash.restore')}
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {!loading && items.length < total && (
        <div className="flex justify-center">
          <Button variant="secondary" loading={loadingMore} onClick={() => void loadMore()}>
            {t('trash.load_more')}
          </Button>
        </div>
      )}
    </section>
  );
}
