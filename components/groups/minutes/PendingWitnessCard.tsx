'use client';

import Link from 'next/link';
import {useLocale, useTranslations} from 'next-intl';
import {BellRing, CheckCheck} from 'lucide-react';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import Skeleton from '@/components/ui/Skeleton';
import {useAuthStore} from '@/lib/store/authStore';
import {usePendingWitnessMinutes} from '@/hooks/usePendingWitnessMinutes';
import {formatDateTime} from './minutesDates';

const SHOWN = 8;

/**
 * The global "to do" on the dashboard: minutes awaiting the signed-in user's witness vote, in every group.
 * Shows nothing when the request fails (a user with no group at all has nothing to be told about).
 */
export default function PendingWitnessCard() {
  const t = useTranslations('group_minutes');
  const locale = useLocale();
  const user = useAuthStore((s) => s.user);
  const {minutes, total, groupNames, loading, failed} = usePendingWitnessMinutes({
    enabled: !!user,
    loadNumber: SHOWN,
    withGroupNames: true
  });

  if (failed) return null;

  /** The list sends `group_name`; the resolved group list only backs up records without one. */
  const groupLabel = (item: {group_id: string; group_name?: string | null}) => item.group_name ?? groupNames[item.group_id];

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-section text-fg">
          <BellRing size={16} strokeWidth={1.75} />
          <span>{t('pending_all.title')}</span>
        </div>
        {total > 0 && (
          <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
            {total}
          </span>
        )}
      </div>

      {!user || (loading && minutes.length === 0) ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : minutes.length === 0 ? (
        <EmptyState icon={<CheckCheck size={20} strokeWidth={1.75} className="text-fg-muted" />}>
          {t('pending_all.empty')}
        </EmptyState>
      ) : (
        <>
          <ul className="space-y-1">
            {minutes.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/${locale}/groups/${encodeURIComponent(item.group_id)}/minutes/${encodeURIComponent(item.id)}`}
                  className="flex items-center justify-between gap-3 rounded-md p-3 transition-colors hover:bg-surface-hover"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium text-fg">{item.subject}</span>
                    <span className="block truncate text-caption text-fg-muted">
                      {groupLabel(item) ? `${groupLabel(item)} · ` : ''}
                      {formatDateTime(item.meeting_date, locale)}
                      {item.version > 1 ? ` · ${t('list.version_label', {version: item.version})}` : ''}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
                    {t('list.awaiting_you')}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {total > minutes.length && (
            <p className="mt-2 text-caption text-fg-muted">{t('pending_all.more', {count: total - minutes.length})}</p>
          )}
        </>
      )}
    </Card>
  );
}
