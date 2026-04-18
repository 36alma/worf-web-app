import {Task, STATUS_LABELS, STATUS_COLORS, PRIORITY_COLORS} from './types';
import clsx from 'clsx';
import {Calendar} from 'lucide-react';

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
  
  const allSelected = tasks.length > 0 && selectedTaskIds.length === tasks.length;
  const isPartiallySelected = selectedTaskIds.length > 0 && selectedTaskIds.length < tasks.length;

  return (
    <div className="w-full overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] mt-2 shadow-sm">
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
                    className="rounded border-[var(--border-default)] text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
              )}
              <th className="px-4 py-3 font-medium w-28">Kulcs</th>
              <th className="px-4 py-3 font-medium">Feladat Név</th>
              <th className="px-4 py-3 font-medium w-32">Prioritás</th>
              <th className="px-4 py-3 font-medium w-36">Státusz</th>
              <th className="px-4 py-3 font-medium w-20 text-center">Haladás</th>
              <th className="px-4 py-3 font-medium w-36">Határidő</th>
              <th className="px-4 py-3 font-medium w-24 text-center">Megbízott</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-[var(--text-tertiary)]">
                  Nincs találat a szűrések alapján.
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
                      isSelected && "bg-indigo-50/50 hover:bg-indigo-50/70 dark:bg-indigo-900/10 dark:hover:bg-indigo-900/20"
                    )}
                  >
                    {permissions.task.delete && (
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onToggleSelection(task.id)}
                          className="rounded border-[var(--border-default)] text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                    )}
                    {/* Issue Key */}
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono font-semibold text-[var(--text-tertiary)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-1.5 py-0.5 rounded">
                        {task.issue_key}
                      </span>
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
                          {task.priority}
                        </span>
                      ) : <span className="text-[var(--text-tertiary)]">-</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border",
                        STATUS_COLORS[task.status as keyof typeof STATUS_COLORS] || 'bg-gray-100 text-gray-700 border-gray-200'
                      )}>
                        {STATUS_LABELS[task.status as keyof typeof STATUS_LABELS] || task.status}
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
                                subtasksCompleted === subtasksTotal ? "bg-emerald-500" : "bg-indigo-500"
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
                      {task.assignee_id ? (
                        <div className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 ring-2 ring-white">
                          {task.assignee_id.substring(0, 2).toUpperCase()}
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
  );
}
