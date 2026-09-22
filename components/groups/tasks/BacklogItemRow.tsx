'use client';

import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import clsx from 'clsx';
import {useTranslations} from 'next-intl';
import {GripVertical, Calendar} from 'lucide-react';
import {Task} from './types';
import TaskTypeBadge from './TaskTypeBadge';
import Badge from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';
import {translateTaskStatus} from '@/lib/i18n/tasks';

type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  TODO: 'neutral',
  IN_PROGRESS: 'info',
  IN_REVIEW: 'info',
  BLOCKED: 'danger',
  DONE: 'success'
};

export interface BacklogItemRowProps {
  task: Task;
  permissions: {task: {modify: boolean}};
  onClick: () => void;
}

export default function BacklogItemRow({task, permissions, onClick}: BacklogItemRowProps) {
  const t = useTranslations('tasks');
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({
    id: task.id,
    data: {type: 'BacklogTask', task},
    disabled: !permissions.task.modify
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined
  };

  const status = task.status?.toUpperCase() ?? '';

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onClick}
      className={clsx(
        'group flex cursor-pointer items-center gap-3 border-b border-border bg-surface-1 px-3 py-2 transition-colors last:border-b-0 hover:bg-surface-2',
        isDragging && 'ring-2 ring-accent'
      )}
    >
      <div
        {...(permissions.task.modify ? attributes : {})}
        {...(permissions.task.modify ? listeners : {})}
        onClick={(event) => event.stopPropagation()}
        className={clsx(
          'shrink-0 p-1 text-fg-muted opacity-0 transition-opacity group-hover:opacity-100',
          permissions.task.modify ? 'cursor-grab active:cursor-grabbing' : 'invisible'
        )}
      >
        <GripVertical size={14} />
      </div>

      <TaskTypeBadge task_type={task.task_type} issue_key={task.issue_key} size="sm" />

      <span className="min-w-0 flex-1 truncate text-sm text-fg">{task.summary}</span>

      {task.story_points != null && task.story_points > 0 && (
        <Badge variant="neutral" className="hidden sm:inline-flex">{task.story_points} SP</Badge>
      )}

      {status && (
        <Badge variant={STATUS_VARIANT[status] ?? 'neutral'}>{translateTaskStatus(t, status)}</Badge>
      )}

      {task.due_at && (
        <span className="hidden shrink-0 items-center gap-1 text-caption text-fg-muted sm:inline-flex">
          <Calendar size={12} />
          {new Date(task.due_at).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}
        </span>
      )}

      <Avatar name={task.assigneer_id?.assigneer_fullname} size="sm" />
    </div>
  );
}
