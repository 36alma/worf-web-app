import {Task} from './types';
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

const STATUS_LABELS: Record<string, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done'
};

const STATUS_COLORS: Record<string, string> = {
  TODO: 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800/50 dark:text-zinc-300',
  IN_PROGRESS: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300',
  DONE: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300'
};

const PRIORITY_COLORS: Record<string, string> = {
  HIGH: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300',
  URGENT: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300',
  MEDIUM: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300',
  NORMAL: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300',
  LOW: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300',
};

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
              <th className="px-4 py-3 font-medium">Feladat Név</th>
              <th className="px-4 py-3 font-medium w-32">Prioritás</th>
              <th className="px-4 py-3 font-medium w-36">Státusz</th>
              <th className="px-4 py-3 font-medium w-36">Határidő</th>
              <th className="px-4 py-3 font-medium w-24 text-center">Megbízott</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-[var(--text-tertiary)]">
                  Nincs találat a szűrések alapján.
                </td>
              </tr>
            ) : (
              tasks.map(task => {
                const isSelected = selectedTaskIds.includes(task.task_id);
                const isOverdue = task.due_at && new Date(task.due_at).getTime() < new Date().getTime();
                const isDueSoon = task.due_at && !isOverdue && new Date(task.due_at).getTime() < new Date().getTime() + 2 * 24 * 60 * 60 * 1000;
                
                return (
                  <tr 
                    key={task.task_id} 
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
                          onChange={() => onToggleSelection(task.task_id)}
                          className="rounded border-[var(--border-default)] text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                    )}
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
                        STATUS_COLORS[task.status] || 'bg-gray-100 text-gray-700 border-gray-200'
                      )}>
                        {STATUS_LABELS[task.status] || task.status}
                      </span>
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
