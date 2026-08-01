import {useState, useEffect, useRef} from 'react';
import {Calendar, GripVertical} from 'lucide-react';
import clsx from 'clsx';
import {Task} from './types';
import TaskTypeBadge from './TaskTypeBadge';
import Badge from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';

type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

// Priority → muted tint badge (spec §8/1: solid MEDIUM/LOW badges → tint).
const PRIORITY_VARIANT: Record<string, BadgeVariant> = {
  LOW: 'success',
  MEDIUM: 'warning',
  HIGH: 'danger',
  CRITICAL: 'danger',
  URGENT: 'danger',
};

export interface TaskCardProps {
  task: Task;
  permissions: any;
  onClick: () => void;
  dragListeners?: any;
  isDragging?: boolean;
  isSelected?: boolean;
  onToggleSelection?: () => void;
  onModifySummary?: (newSummary: string) => void;
}

export default function TaskCard({
  task,
  permissions,
  onClick,
  dragListeners,
  isDragging,
  isSelected,
  onToggleSelection,
  onModifySummary
}: TaskCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editSummary, setEditSummary] = useState(task.summary);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!permissions.task.modify) return;
    setIsEditing(true);
    setEditSummary(task.summary);
  };

  const saveEdit = () => {
    if (editSummary.trim() && editSummary !== task.summary && onModifySummary) {
      onModifySummary(editSummary.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveEdit();
    if (e.key === 'Escape') {
      setIsEditing(false);
      setEditSummary(task.summary);
    }
  };

  const isOverdue = task.due_at && new Date(task.due_at).getTime() < new Date().getTime();
  const isDueSoon = task.due_at && !isOverdue && new Date(task.due_at).getTime() < new Date().getTime() + 2 * 24 * 60 * 60 * 1000;

  const subtasksTotal = task.subtasks_total ?? 0;
  const subtasksCompleted = task.subtasks_completed ?? 0;
  const subtaskPercent = subtasksTotal > 0 ? Math.min(100, Math.max(0, (subtasksCompleted / subtasksTotal) * 100)) : 0;

  return (
    <div
      onClick={!isEditing ? onClick : undefined}
      style={{touchAction: 'manipulation'}}
      className={clsx(
        'group relative flex cursor-pointer flex-col gap-2.5 rounded-lg border bg-surface-2 p-3 transition-colors',
        isDragging
          ? 'border-accent opacity-90 ring-2 ring-accent'
          : isSelected
            ? 'border-accent ring-2 ring-accent'
            : 'border-border hover:border-border-strong'
      )}
    >
      {/* Selection checkbox */}
      <div className="absolute left-2 top-2 z-10 flex flex-col items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        {permissions.task.delete && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onToggleSelection?.();
            }}
            onClick={(e) => e.stopPropagation()}
            className="size-4 cursor-pointer rounded border border-border accent-[var(--accent)]"
          />
        )}
      </div>

      {/* Top row: issue_key + task_type + drag handle */}
      <div className="flex items-center justify-between gap-2 pl-6">
        <TaskTypeBadge task_type={task.task_type} issue_key={task.issue_key} size="sm" />

        {permissions.task.modify && (
          <div
            {...dragListeners}
            onClick={(e) => e.stopPropagation()}
            title="Drag"
            className="-mr-1 -mt-1 cursor-grab p-1 text-fg-muted transition-colors hover:text-fg active:cursor-grabbing"
          >
            <GripVertical size={16} />
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="pl-6">
        {isEditing ? (
          <input
            ref={inputRef}
            value={editSummary}
            onChange={(e) => setEditSummary(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="w-full rounded-md border border-border-focus bg-transparent px-1 py-0.5 text-sm font-medium text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          />
        ) : (
          <h4
            onDoubleClick={handleDoubleClick}
            className="line-clamp-2 text-sm font-medium leading-tight text-fg"
          >
            {task.summary}
          </h4>
        )}
      </div>

      {/* Meta row: priority, story points, due date, assignee */}
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {task.priority && (
          <Badge variant={PRIORITY_VARIANT[task.priority.toUpperCase()] ?? 'neutral'}>
            {task.priority.toUpperCase()}
          </Badge>
        )}

        {task.story_points !== null && task.story_points !== undefined && task.story_points > 0 && (
          <Badge variant="neutral">{task.story_points} SP</Badge>
        )}

        {task.due_at && (
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
            <Calendar size={12} />
            {new Date(task.due_at).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}
          </span>
        )}

        {task.assigneer_id?.assigneer_fullname && (
          <Avatar
            name={task.assigneer_id.assigneer_fullname}
            size="sm"
            className="ml-auto"
          />
        )}
      </div>

      {/* Subtask progress */}
      {subtasksTotal > 0 && (
        <div className="mt-1 flex w-full items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full border border-border bg-surface-1">
            <div
              className={clsx(
                'h-full rounded-full transition-all duration-500 ease-out',
                subtasksCompleted === subtasksTotal ? 'bg-success' : 'bg-info'
              )}
              style={{ width: `${subtaskPercent}%` }}
            />
          </div>
          <span className="text-caption font-medium tabular-nums text-fg-muted">
            {subtasksCompleted}/{subtasksTotal}
          </span>
        </div>
      )}

      {/* Categories (user-assigned colours are intentional per-item colour) */}
      {task.categories && task.categories.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1.5 border-t border-border pt-2">
          {task.categories.map((c) => (
            <span
              key={c.task_category_id}
              style={{backgroundColor: c.color + '22', color: c.color}}
              className="rounded-sm px-2 py-0.5 text-caption font-medium uppercase"
            >
              {c.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
