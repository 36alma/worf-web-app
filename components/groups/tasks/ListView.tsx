import {useTranslations} from 'next-intl';
import {Task, STATUS_COLORS, PRIORITY_COLORS} from './types';
import clsx from 'clsx';
import {Calendar} from 'lucide-react';
import TaskTypeBadge from './TaskTypeBadge';
import TaskListCard from './TaskListCard';
import {translateTaskPriority, translateTaskStatus} from '@/lib/i18n/tasks';

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
    <div className="w-full mt-2">

      {/* ── Mobil kártyalista (< lg) ── */}
      <div className="block lg:hidden overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-sm">
        {tasks.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-[var(--text-tertiary)]">
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

      {/* ── Desktop tábla (≥ lg) ── */}
      <div className="hidden lg:block overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-b border-[var(--border-subtle)]">
              <tr>
                {permissions.task.delete && (
                  <th className="px-4 py-3 w-12 font-medium">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={input => { if (input) input.indeterminate = isPartiallySelected; }}
                      onChange={onToggleAll}
                      className="rounded border-[var(--border-default)] text-orange-500 focus:ring-orange-500 accent-orange-500"
                    />
                  </th>
                )}
                <th className="px-4 py-3 font-medium w-28">{t('table.key')}</th>
                <th className="px-4 py-3 font-medium">{t('table.summary')}</th>
                <th className="px-4 py-3 font-medium w-32">{t('table.priority')}</th>
                <th className="px-4 py-3 font-medium w-36">{t('table.status')}</th>
                <th className="px-4 py-3 font-medium w-20 text-center">{t('table.progress')}</th>
                <th className="px-4 py-3 font-medium w-36">{t('table.dueDate')}</th>
                <th className="px-4 py-3 font-medium w-24 text-center">{t('table.assignee')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-[var(--text-tertiary)]">
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
                        "cursor-pointer transition-colors hover:bg-[var(--bg-hover)] group",
                        isSelected && "bg-orange-50/50 hover:bg-orange-50/70 dark:bg-orange-900/10 dark:hover:bg-orange-900/20"
                      )}
                    >
                      {permissions.task.delete && (
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => onToggleSelection(task.id)}
                            className="rounded border-[var(--border-default)] text-orange-500 focus:ring-orange-500 accent-orange-500"
                          />
                        </td>
                      )}
                      {/* Issue Key & Type Badge */}
                      <td className="px-4 py-3">
                        <TaskTypeBadge task_type={task.task_type} issue_key={task.issue_key} size="sm" />
                      </td>
                      <td className="px-4 py-3 text-[var(--text-primary)]">
                          <div className="font-medium truncate max-w-md">{task.summary}</div>
                          {task.categories && task.categories.length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {task.categories.map((c) => (
                                <span
                                  key={c.task_category_id}
                                  style={{backgroundColor: c.color + '20', color: c.color}}
                                  className="px-1.5 py-0.5 text-[10px] uppercase font-semibold rounded"
                                >
                                  {c.name}
                                </span>
                              ))}
                            </div>
                          )}
                      </td>
                      <td className="px-4 py-3">
                        {task.priority ? (
                          <span className={clsx(
                            "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border",
                            PRIORITY_COLORS[task.priority.toUpperCase()] || 'bg-gray-100 text-gray-700 border-gray-200'
                          )}>
                            {translateTaskPriority(t, task.priority)}
                          </span>
                        ) : <span className="text-[var(--text-tertiary)]">-</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx(
                          "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border",
                          STATUS_COLORS[task.status as keyof typeof STATUS_COLORS] || 'bg-gray-100 text-gray-700 border-gray-200'
                        )}>
                          {translateTaskStatus(t, task.status)}
                        </span>
                      </td>
                      {/* Subtask Progress */}
                      <td className="px-4 py-3 text-center">
                        {subtasksTotal > 0 ? (
                          <div className="flex items-center gap-1.5" title={`${subtasksCompleted}/${subtasksTotal}`}>
                            <div className="flex-1 h-1.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-full overflow-hidden min-w-[40px]">
                              <div
                                className={clsx(
                                  "h-full rounded-full",
                                  subtasksCompleted === subtasksTotal ? "bg-emerald-500" : "bg-orange-500"
                                )}
                                style={{ width: `${subtaskPercent}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-bold text-[var(--text-tertiary)] tabular-nums">{subtasksCompleted}/{subtasksTotal}</span>
                          </div>
                        ) : <span className="text-[var(--text-tertiary)]">-</span>}
                      </td>
                      <td className="px-4 py-3">
                        {task.due_at ? (
                          <div className={clsx(
                            "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs border",
                            isOverdue ? "bg-red-50 border-red-200 text-red-700" :
                            isDueSoon ? "bg-yellow-50 border-yellow-200 text-yellow-700" :
                            "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-secondary)] group-hover:border-[var(--border-default)]"
                          )}>
                            <Calendar size={12} />
                            {new Date(task.due_at).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}
                          </div>
                        ) : <span className="text-[var(--text-tertiary)] ml-5">-</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {task.assigneer_id?.assigneer_fullname ? (
                          <div className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30 text-xs font-bold text-orange-700 dark:text-orange-300 ring-2 ring-white dark:ring-zinc-800" title={task.assigneer_id.assigneer_fullname}>
                            {task.assigneer_id.assigneer_fullname.substring(0, 2).toUpperCase()}
                          </div>
                        ) : <span className="text-[var(--text-tertiary)]">-</span>}
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
