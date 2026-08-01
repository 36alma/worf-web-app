import {useTranslations} from 'next-intl';
import {Task} from './types';
import clsx from 'clsx';
import {Calendar} from 'lucide-react';
import TaskTypeBadge from './TaskTypeBadge';
import TaskListCard from './TaskListCard';
import Badge from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';
import {translateTaskPriority, translateTaskStatus} from '@/lib/i18n/tasks';

type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

const PRIORITY_VARIANT: Record<string, BadgeVariant> = {
  LOW: 'success',
  MEDIUM: 'warning',
  HIGH: 'danger',
  CRITICAL: 'danger',
  URGENT: 'danger',
};

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  TODO: 'neutral',
  IN_PROGRESS: 'warning',
  IN_REVIEW: 'info',
  DONE: 'success',
  BLOCKED: 'danger',
};

export interface ListViewProps {
  tasks: Task[];
  permissions: any;
  onTaskClick: (task: Task) => void;
  selectedTaskIds: string[];
  onToggleSelection: (taskId: string) => void;
  onToggleAll: () => void;
}

export default function ListView({
  tasks,
  permissions,
  onTaskClick,
  selectedTaskIds,
  onToggleSelection,
  onToggleAll
}: ListViewProps) {
  const t = useTranslations('tasks');

  const allSelected = tasks.length > 0 && selectedTaskIds.length === tasks.length;
  const isPartiallySelected = selectedTaskIds.length > 0 && selectedTaskIds.length < tasks.length;

  return (
    <div className="mt-2 w-full">
      {/* ── Mobile card list (< lg) ── */}
      <div className="block overflow-hidden rounded-lg border border-border bg-surface-1 lg:hidden">
        {tasks.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-fg-muted">
            {t('table.emptyText')}
          </div>
        ) : (
          <div>
            {tasks.map((task) => (
              <TaskListCard
                key={task.id}
                task={task}
                onClick={() => onTaskClick(task)}
                isSelected={selectedTaskIds.includes(task.id)}
                onToggleSelection={() => onToggleSelection(task.id)}
                showCheckbox={permissions.task.delete}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Desktop table (≥ lg) ── */}
      <div className="hidden overflow-hidden rounded-lg border border-border bg-surface-1 lg:block">
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-left text-sm">
            <thead className="border-b border-border bg-surface-2 text-fg-secondary">
              <tr>
                {permissions.task.delete && (
                  <th className="w-12 px-4 py-3 font-medium">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={input => { if (input) input.indeterminate = isPartiallySelected; }}
                      onChange={onToggleAll}
                      className="rounded border border-border accent-[var(--accent)]"
                    />
                  </th>
                )}
                <th className="w-28 px-4 py-3 font-medium">{t('table.key')}</th>
                <th className="px-4 py-3 font-medium">{t('table.summary')}</th>
                <th className="w-32 px-4 py-3 font-medium">{t('table.priority')}</th>
                <th className="w-36 px-4 py-3 font-medium">{t('table.status')}</th>
                <th className="w-20 px-4 py-3 text-center font-medium">{t('table.progress')}</th>
                <th className="w-36 px-4 py-3 font-medium">{t('table.dueDate')}</th>
                <th className="w-24 px-4 py-3 text-center font-medium">{t('table.assignee')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-fg-muted">
                    {t('table.emptyText')}
                  </td>
                </tr>
              ) : (
                tasks.map(task => {
                  const isSelected = selectedTaskIds.includes(task.id);
                  const isOverdue = task.due_at && new Date(task.due_at).getTime() < new Date().getTime();
                  const isDueSoon = task.due_at && !isOverdue && new Date(task.due_at).getTime() < new Date().getTime() + 2 * 24 * 60 * 60 * 1000;
                  const subtasksTotal = task.subtasks_total ?? 0;
                  const subtasksCompleted = task.subtasks_completed ?? 0;
                  const subtaskPercent = subtasksTotal > 0 ? Math.min(100, (subtasksCompleted / subtasksTotal) * 100) : 0;

                  return (
                    <tr
                      key={task.id}
                      onClick={() => onTaskClick(task)}
                      className={clsx(
                        'group cursor-pointer transition-colors hover:bg-surface-hover',
                        isSelected && 'bg-accent/5 hover:bg-accent/10'
                      )}
                    >
                      {permissions.task.delete && (
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => onToggleSelection(task.id)}
                            className="rounded border border-border accent-[var(--accent)]"
                          />
                        </td>
                      )}
                      {/* Issue key & type badge */}
                      <td className="px-4 py-3">
                        <TaskTypeBadge task_type={task.task_type} issue_key={task.issue_key} size="sm" />
                      </td>
                      <td className="px-4 py-3 text-fg">
                        <div className="max-w-md truncate font-medium">{task.summary}</div>
                        {task.categories && task.categories.length > 0 && (
                          <div className="mt-1 flex gap-1">
                            {task.categories.map((c) => (
                              <span
                                key={c.task_category_id}
                                style={{backgroundColor: c.color + '22', color: c.color}}
                                className="rounded-sm px-1.5 py-0.5 text-caption font-medium uppercase"
                              >
                                {c.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {task.priority ? (
                          <Badge variant={PRIORITY_VARIANT[task.priority.toUpperCase()] ?? 'neutral'}>
                            {translateTaskPriority(t, task.priority)}
                          </Badge>
                        ) : <span className="text-fg-muted">-</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_VARIANT[task.status as string] ?? 'neutral'}>
                          {translateTaskStatus(t, task.status)}
                        </Badge>
                      </td>
                      {/* Subtask progress */}
                      <td className="px-4 py-3 text-center">
                        {subtasksTotal > 0 ? (
                          <div className="flex items-center gap-1.5" title={`${subtasksCompleted}/${subtasksTotal}`}>
                            <div className="h-1.5 min-w-[40px] flex-1 overflow-hidden rounded-full border border-border bg-surface-2">
                              <div
                                className={clsx(
                                  'h-full rounded-full',
                                  subtasksCompleted === subtasksTotal ? 'bg-success' : 'bg-info'
                                )}
                                style={{ width: `${subtaskPercent}%` }}
                              />
                            </div>
                            <span className="text-caption font-medium tabular-nums text-fg-muted">{subtasksCompleted}/{subtasksTotal}</span>
                          </div>
                        ) : <span className="text-fg-muted">-</span>}
                      </td>
                      <td className="px-4 py-3">
                        {task.due_at ? (
                          <span className={clsx(
                            'inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-caption font-medium',
                            isOverdue ? 'bg-danger-bg text-danger' :
                            isDueSoon ? 'bg-warning-bg text-warning' :
                            'text-fg-muted'
                          )}>
                            <Calendar size={12} />
                            {new Date(task.due_at).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}
                          </span>
                        ) : <span className="ml-5 text-fg-muted">-</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {task.assigneer_id?.assigneer_fullname ? (
                          <Avatar name={task.assigneer_id.assigneer_fullname} size="sm" className="mx-auto" />
                        ) : <span className="text-fg-muted">-</span>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
