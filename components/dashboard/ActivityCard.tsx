'use client';

import {useEffect, useState} from 'react';
import Link from 'next/link';
import {useLocale, useTranslations} from 'next-intl';
import toast from 'react-hot-toast';
import {Activity, AlertCircle, CheckSquare, Clock, FileText} from 'lucide-react';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import Skeleton from '@/components/ui/Skeleton';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select';
import TaskDetailModal from '@/components/groups/tasks/TaskDetailModal';
import type {Task} from '@/components/groups/tasks/types';
import {useOpenErrorToast} from '@/components/groups/minutes/editor/modals/shared';
import {useActivityFeed} from '@/hooks/useActivityFeed';
import {useGroupContext} from '@/hooks/useGroupContext';
import {useUserGroups} from '@/hooks/useUserGroups';
import {describeActivity, type ActivityTranslator} from '@/lib/i18n/dashboardActivity';
import {translateTaskPriority, translateTaskStatus} from '@/lib/i18n/tasks';
import {getTask} from '@/lib/api/tasks';
import {useAuthStore} from '@/lib/store/authStore';
import type {ActivityItem} from '@/lib/types/dashboard';
import {cn} from '@/lib/utils/cn';
import {getDateLocale} from '@/lib/utils/calendarHelpers';
import {ACTIVITY_FILTERS, activityKey, type ActivityFilter} from '@/lib/utils/dashboardActivity';
import {describeElapsed} from '@/lib/utils/dashboardDates';
import {normalizeGroupId} from '@/lib/utils/groupId';
import {toTaskModalPermissions} from '@/lib/utils/dashboardTasks';
import {useDashboard} from './DashboardProvider';

/** Radix items cannot carry an empty value, so "all groups" needs a sentinel. */
const ALL_GROUPS = '__all__';

const ROW_CLASS =
  'flex w-full items-start gap-3 rounded-md p-3 text-left transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50';

/**
 * "Recent activity" across every group, newest first, paged by cursor. A task row opens the group's own
 * `TaskDetailModal`; a minutes row is a link to the record.
 */
export default function ActivityCard() {
  const t = useTranslations('dashboard.activity');
  const td = useTranslations('dashboard');
  const tt = useTranslations('tasks');
  const locale = useLocale();
  const user = useAuthStore((s) => s.user);
  const reportOpenError = useOpenErrorToast();
  const {refreshKeys, refresh} = useDashboard();

  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [groupId, setGroupId] = useState<string | null>(null);
  const {groups} = useUserGroups(!!user);
  const {items, hasMore, loading, loadingMore, failed, rateLimited, loadMore, retry} = useActivityFeed({
    enabled: !!user,
    filter,
    groupId,
    refreshKey: refreshKeys.activity
  });

  // The task a row asked to open, and the record once it has been fetched.
  const [openTask, setOpenTask] = useState<{group_id: string; task_id: string} | null>(null);
  const [task, setTask] = useState<Task | null>(null);
  const groupContext = useGroupContext(openTask?.group_id ?? null);

  useEffect(() => {
    if (!openTask) {
      setTask(null);
      return;
    }
    let mounted = true;
    getTask(openTask)
      .then(({data}) => {
        if (!mounted) return;
        const loaded = (data?.task ?? data) as Task & {task_id?: string};
        setTask({...loaded, id: loaded.id || loaded.task_id || openTask.task_id});
      })
      .catch((error) => {
        if (!mounted) return;
        reportOpenError(error);
        setOpenTask(null);
      });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openTask]);

  const translator = t as unknown as ActivityTranslator;
  const translateValue = (type: string, value: string) =>
    type === 'task.status_changed'
      ? translateTaskStatus(tt, value)
      : type === 'task.priority_changed'
        ? translateTaskPriority(tt, value)
        : value;

  const now = new Date();
  const dateLocale = getDateLocale(locale);
  const relative = new Intl.RelativeTimeFormat(dateLocale, {numeric: 'auto'});
  const absolute = new Intl.DateTimeFormat(dateLocale, {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'});

  const whenLabel = (item: ActivityItem) => {
    const at = new Date(item.occurred_at);
    if (Number.isNaN(at.getTime())) return '';
    const elapsed = describeElapsed(at, now);
    return elapsed ? relative.format(-elapsed.value, elapsed.unit) : absolute.format(at);
  };

  const handleLoadMore = async () => {
    try {
      await loadMore();
    } catch {
      toast.error(rateLimited ? t('rate_limited') : t('load_more_error'));
    }
  };

  const showSkeleton = items === null && !failed;

  const rowBody = (item: ActivityItem) => (
    <>
      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-2 text-fg-secondary">
        {item.entity.type === 'task' ? <CheckSquare size={16} strokeWidth={1.75} /> : <FileText size={16} strokeWidth={1.75} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] leading-snug text-fg">{describeActivity(translator, item, translateValue)}</span>
        <span className="block truncate text-caption text-fg-muted">
          {[item.group_name, whenLabel(item)].filter(Boolean).join(' · ')}
        </span>
      </span>
    </>
  );

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-section text-fg">
          <Activity size={16} strokeWidth={1.75} />
          <span>{td('recent_activity')}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label={t('filter_label')} className="inline-flex rounded-md border border-border p-0.5 text-caption">
            {ACTIVITY_FILTERS.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
                className={cn(
                  'rounded px-2.5 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
                  filter === value ? 'bg-surface-2 text-fg' : 'text-fg-muted hover:text-fg'
                )}
              >
                {t(`filter_${value}`)}
              </button>
            ))}
          </div>
          {groups.length > 1 && (
            <Select value={groupId ?? ALL_GROUPS} onValueChange={(value) => setGroupId(value === ALL_GROUPS ? null : value)}>
              <SelectTrigger aria-label={t('group_filter_label')} className="h-8 w-auto max-w-[11rem] text-caption">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_GROUPS}>{t('all_groups')}</SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {showSkeleton ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : items === null ? (
        <EmptyState
          icon={<AlertCircle size={20} strokeWidth={1.75} className="text-fg-muted" />}
          action={
            <button type="button" onClick={retry} className="rounded-md px-2 py-1 text-caption text-fg-secondary transition-colors hover:bg-surface-hover hover:text-fg">
              {t('retry')}
            </button>
          }
        >
          {rateLimited ? t('rate_limited') : t('error')}
        </EmptyState>
      ) : items.length === 0 ? (
        <EmptyState icon={<Clock size={20} strokeWidth={1.75} className="text-fg-muted" />}>
          {td('no_recent_activity')}
          <span className="mt-1 block text-fg-muted">{td('activity_hint')}</span>
        </EmptyState>
      ) : (
        <>
          <ul className={cn('space-y-1 transition-opacity', loading && 'opacity-70')}>
            {items.map((item, index) => {
              const key = activityKey(item, index);
              const groupPath = encodeURIComponent(normalizeGroupId(item.group_id));
              return (
                <li key={key}>
                  {item.entity.type === 'minutes' ? (
                    <Link href={`/${locale}/groups/${groupPath}/minutes/${encodeURIComponent(item.entity.id)}`} className={ROW_CLASS}>
                      {rowBody(item)}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className={ROW_CLASS}
                      onClick={() => setOpenTask({group_id: normalizeGroupId(item.group_id), task_id: item.entity.id})}
                    >
                      {rowBody(item)}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {hasMore && (
            <div className="mt-2 flex justify-center">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="rounded-md px-3 py-1.5 text-caption text-fg-secondary transition-colors hover:bg-surface-hover hover:text-fg disabled:opacity-50"
              >
                {loadingMore ? t('loading_more') : t('load_more')}
              </button>
            </div>
          )}
        </>
      )}

      {/* The record is fetched on click and the group's permissions with it; the modal opens once both are here. */}
      <TaskDetailModal
        open={!!task && !groupContext.loading}
        onClose={() => setOpenTask(null)}
        task={task}
        groupId={openTask?.group_id ?? ''}
        permissions={toTaskModalPermissions(groupContext.hasPermission)}
        onUpdateTask={(updated) => {
          setTask(updated);
          refresh('tasks', 'summary', 'activity');
        }}
        groupUsers={groupContext.groupUsers}
        groupUsersLoading={groupContext.groupUsersLoading}
        sprints={groupContext.sprints}
      />
    </Card>
  );
}
