'use client';

import {Calendar} from 'lucide-react';
import clsx from 'clsx';
import {useTranslations} from 'next-intl';
import {Task, STATUS_COLORS, PRIORITY_COLORS} from './types';
import TaskTypeBadge from './TaskTypeBadge';
import {translateTaskPriority, translateTaskStatus} from '@/lib/i18n/tasks';

export interface TaskListCardProps {
  task: Task;
  onClick: () => void;
  isSelected?: boolean;
  onToggleSelection?: () => void;
  showCheckbox?: boolean;
}

export default function TaskListCard({
  task,
  onClick,
  isSelected,
  onToggleSelection,
  showCheckbox,
}: TaskListCardProps) {
  const t = useTranslations('tasks');

  const isOverdue =
    task.due_at && new Date(task.due_at).getTime() < new Date().getTime();
  const isDueSoon =
    task.due_at &&
    !isOverdue &&
    new Date(task.due_at).getTime() < new Date().getTime() + 2 * 24 * 60 * 60 * 1000;

  return (
    <div
      onClick={onClick}
      style={{touchAction: 'manipulation'}}
      className={clsx(
        'flex flex-col gap-2 border-b border-white/5 px-4 py-3.5 cursor-pointer transition-colors last:border-b-0',
        isSelected
          ? 'bg-orange-900/10 active:bg-orange-900/20'
          : 'hover:bg-[var(--bg-hover)] active:bg-[var(--bg-hover)]'
      )}
    >
      {/* Sor 1: checkbox + type badge + státusz + prioritás */}
      <div className="flex items-center gap-2 flex-wrap">
        {showCheckbox && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onToggleSelection?.();
            }}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 shrink-0 rounded border-gray-300 accent-orange-500 text-orange-500 focus:ring-orange-500"
          />
        )}
        <TaskTypeBadge task_type={task.task_type} issue_key={task.issue_key} size="sm" />
        <span
          className={clsx(
            'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border',
            STATUS_COLORS[task.status as keyof typeof STATUS_COLORS] ||
              'bg-gray-100 text-gray-700 border-gray-200'
          )}
        >
          {translateTaskStatus(t, task.status)}
        </span>
        {task.priority && (
          <span
            className={clsx(
              'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border',
              PRIORITY_COLORS[task.priority.toUpperCase()] ||
                'bg-gray-100 text-gray-700 border-gray-200'
            )}
          >
            {translateTaskPriority(t, task.priority)}
          </span>
        )}
      </div>

      {/* Sor 2: összefoglaló cím */}
      <p className="text-sm font-medium text-[var(--text-primary)] leading-snug line-clamp-2">
        {task.summary}
      </p>

      {/* Sor 3: határidő + kategóriák + felelős */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {task.due_at ? (
            <div
              className={clsx(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border',
                isOverdue
                  ? 'bg-red-900/20 border-red-800 text-red-400'
                  : isDueSoon
                  ? 'bg-amber-900/20 border-amber-800 text-amber-400'
                  : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-tertiary)]'
              )}
            >
              <Calendar size={11} />
              {new Date(task.due_at).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })}
            </div>
          ) : null}

          {task.categories && task.categories.length > 0 && (
            <div className="flex gap-1">
              {task.categories.slice(0, 2).map((c) => (
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
        </div>

        {/* Felelős avatar */}
        {task.assigneer_id?.assigneer_fullname && (
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30 text-xs font-bold text-orange-700 dark:text-orange-300 ring-2 ring-white dark:ring-zinc-800"
            title={task.assigneer_id.assigneer_fullname}
          >
            {task.assigneer_id.assigneer_fullname.substring(0, 2).toUpperCase()}
          </div>
        )}
      </div>
    </div>
  );
}
