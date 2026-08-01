'use client';

import {Calendar} from 'lucide-react';
import clsx from 'clsx';
import {useTranslations} from 'next-intl';
import {Task} from './types';
import TaskTypeBadge from './TaskTypeBadge';
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
        'flex cursor-pointer flex-col gap-2 border-b border-border px-4 py-3.5 transition-colors last:border-b-0',
        isSelected
          ? 'bg-accent/5 active:bg-accent/10'
          : 'hover:bg-surface-hover active:bg-surface-hover'
      )}
    >
      {/* Row 1: checkbox + type badge + status + priority */}
      <div className="flex flex-wrap items-center gap-2">
        {showCheckbox && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onToggleSelection?.();
            }}
            onClick={(e) => e.stopPropagation()}
            className="size-4 shrink-0 rounded border border-border accent-[var(--accent)]"
          />
        )}
        <TaskTypeBadge task_type={task.task_type} issue_key={task.issue_key} size="sm" />
        <Badge variant={STATUS_VARIANT[task.status as string] ?? 'neutral'}>
          {translateTaskStatus(t, task.status)}
        </Badge>
        {task.priority && (
          <Badge variant={PRIORITY_VARIANT[task.priority.toUpperCase()] ?? 'neutral'}>
            {translateTaskPriority(t, task.priority)}
          </Badge>
        )}
      </div>

      {/* Row 2: summary */}
      <p className="line-clamp-2 text-sm font-medium leading-snug text-fg">
        {task.summary}
      </p>

      {/* Row 3: due date + categories + assignee */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {task.due_at ? (
            <span
              className={clsx(
                'inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-caption font-medium',
                isOverdue
                  ? 'bg-danger-bg text-danger'
                  : isDueSoon
                  ? 'bg-warning-bg text-warning'
                  : 'text-fg-muted'
              )}
            >
              <Calendar size={11} />
              {new Date(task.due_at).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })}
            </span>
          ) : null}

          {task.categories && task.categories.length > 0 && (
            <div className="flex gap-1">
              {task.categories.slice(0, 2).map((c) => (
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
        </div>

        {task.assigneer_id?.assigneer_fullname && (
          <Avatar name={task.assigneer_id.assigneer_fullname} size="sm" className="shrink-0" />
        )}
      </div>
    </div>
  );
}
