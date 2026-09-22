'use client';

import {useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import toast from 'react-hot-toast';
import {AlertCircle, CheckCheck, ChevronDown, ListTodo} from 'lucide-react';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import Skeleton from '@/components/ui/Skeleton';
import Badge from '@/components/ui/Badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from '@/components/ui/DropdownMenu';
import TaskDetailModal from '@/components/groups/tasks/TaskDetailModal';
import TaskTypeBadge from '@/components/groups/tasks/TaskTypeBadge';
import {PRIORITY_VARIANT, STATUS_VARIANT} from '@/components/groups/tasks/TaskListCard';
import {STATUSES} from '@/components/groups/tasks/types';
import {useGroupContext} from '@/hooks/useGroupContext';
import {useMyTasks, type MyTasksFilter} from '@/hooks/useMyTasks';
import {modifyTask} from '@/lib/api/tasks';
import {translateTaskApiError, translateTaskPriority, translateTaskStatus} from '@/lib/i18n/tasks';
import {useAuthStore} from '@/lib/store/authStore';
import type {DashboardTask} from '@/lib/types/dashboard';
import {cn} from '@/lib/utils/cn';
import {getDateLocale} from '@/lib/utils/calendarHelpers';
import {dashboardTaskKey, isTaskOverdue, toTaskModalPermissions} from '@/lib/utils/dashboardTasks';
import {DASHBOARD_TASKS_ANCHOR} from './DashboardKpis';
import {useDashboard} from './DashboardProvider';

const FILTERS: MyTasksFilter[] = ['open', 'overdue'];

/**
 * "My tasks" across every group: rows open the group's own `TaskDetailModal`, and the status badge changes the status
 * in place (optimistically, reverted when the server refuses).
 */
export default function MyTasksCard() {
  const t = useTranslations('dashboard.my_tasks');
  const tt = useTranslations('tasks');
  const locale = useLocale();
  const user = useAuthStore((s) => s.user);
  const {summary, refreshKeys, refresh} = useDashboard();
  const [filter, setFilter] = useState<MyTasksFilter>('open');
  const {tasks, total, loading, failed, rateLimited, patchTask, retry} = useMyTasks({
    enabled: !!user,
    filter,
    refreshKey: refreshKeys.tasks
  });

  const [selected, setSelected] = useState<DashboardTask | null>(null);
  const groupContext = useGroupContext(selected?.group_id ?? null);
  const selectedKey = selected ? dashboardTaskKey(selected) : null;

  const now = new Date();
  const dateFormat = new Intl.DateTimeFormat(getDateLocale(locale), {month: 'short', day: 'numeric'});

  const handleStatusChange = async (task: DashboardTask, status: string) => {
    if (status === task.status) return;
    const key = dashboardTaskKey(task);
    const previous = task.status;
    patchTask(key, {status});
    try {
      await modifyTask({group_id: task.group_id, task_id: task.id, status});
      toast.success(tt('toasts.statusUpdated'));
      refresh('tasks', 'summary', 'activity');
    } catch (error) {
      patchTask(key, {status: previous});
      toast.error(translateTaskApiError(tt, error, 'toasts.updateError'));
    }
  };

  const showSkeleton = tasks === null && !failed;

  return (
    <Card id={DASHBOARD_TASKS_ANCHOR} className="scroll-mt-4 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-section text-fg">
          <ListTodo size={16} strokeWidth={1.75} />
          <span>{t('title')}</span>
          {total > 0 && (
            <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-fg-secondary">
              {total}
            </span>
          )}
        </div>
        <div role="group" aria-label={t('filter_label')} className="inline-flex rounded-md border border-border p-0.5 text-caption">
          {FILTERS.map((value) => {
            const overdueCount = value === 'overdue' ? summary?.overdue_tasks_count ?? 0 : 0;
            return (
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
                {overdueCount > 0 && <span className="ml-1.5 font-semibold text-danger">{overdueCount}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {showSkeleton ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : tasks === null ? (
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
      ) : tasks.length === 0 ? (
        <EmptyState icon={<CheckCheck size={20} strokeWidth={1.75} className="text-fg-muted" />}>
          {t(`empty_${filter}`)}
        </EmptyState>
      ) : (
        <>
          <ul className={cn('space-y-1 transition-opacity', loading && 'opacity-70')}>
            {tasks.map((task) => {
              const key = dashboardTaskKey(task);
              const overdue = isTaskOverdue(task, now);
              const opening = selectedKey === key && groupContext.loading;
              return (
                <li key={key} className="flex items-center gap-1 rounded-md transition-colors hover:bg-surface-hover">
                  <button
                    type="button"
                    onClick={() => setSelected(task)}
                    aria-busy={opening}
                    className={cn(
                      'flex min-w-0 flex-1 flex-col gap-1 rounded-md p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
                      opening && 'opacity-60'
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <TaskTypeBadge task_type={task.task_type} issue_key={task.issue_key} size="sm" />
                      <span className={cn('truncate text-[13px] font-medium', task.status === 'DONE' ? 'text-fg-muted line-through' : 'text-fg')}>
                        {task.summary}
                      </span>
                    </span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-fg-muted">
                      {task.group_name && <span className="truncate">{task.group_name}</span>}
                      {task.due_at && (
                        <span className={cn(overdue && 'font-medium text-danger')}>
                          {t(overdue ? 'overdue_on' : 'due_on', {date: dateFormat.format(new Date(task.due_at))})}
                        </span>
                      )}
                      {task.priority && (
                        <Badge variant={PRIORITY_VARIANT[task.priority.toUpperCase()] ?? 'neutral'}>
                          {translateTaskPriority(tt, task.priority)}
                        </Badge>
                      )}
                    </span>
                  </button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={t('change_status')}
                        className="mr-2 inline-flex shrink-0 items-center gap-0.5 rounded-md p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                      >
                        <Badge variant={STATUS_VARIANT[task.status] ?? 'neutral'}>{translateTaskStatus(tt, task.status)}</Badge>
                        <ChevronDown size={14} strokeWidth={1.75} className="text-fg-muted" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuRadioGroup value={task.status} onValueChange={(status) => void handleStatusChange(task, status)}>
                        {STATUSES.map((status) => (
                          <DropdownMenuRadioItem key={status} value={status}>
                            {translateTaskStatus(tt, status)}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              );
            })}
          </ul>
          {total > tasks.length && <p className="mt-2 text-caption text-fg-muted">{t('more', {count: total - tasks.length})}</p>}
        </>
      )}

      {/* Permissions are per group and unknown until the group's own request answers, so the modal waits for them. */}
      <TaskDetailModal
        open={!!selected && !groupContext.loading}
        onClose={() => setSelected(null)}
        task={selected}
        groupId={selected?.group_id ?? ''}
        permissions={toTaskModalPermissions(groupContext.hasPermission)}
        onUpdateTask={(updated) => {
          if (!selected) return;
          const merged: DashboardTask = {...selected, ...updated};
          patchTask(selectedKey!, updated);
          setSelected(merged);
          refresh('tasks', 'summary', 'activity');
        }}
        groupUsers={groupContext.groupUsers}
        groupUsersLoading={groupContext.groupUsersLoading}
        sprints={groupContext.sprints}
      />
    </Card>
  );
}
