import {useState, useEffect, useRef} from 'react';
import {Calendar, GripVertical, Bug, BookOpen, Zap, Layers, CheckSquare} from 'lucide-react';
import clsx from 'clsx';
import {Task, PRIORITY_COLORS, TASK_TYPE_LABELS} from './types';

// Task type ikontérkép
const TASK_TYPE_ICONS: Record<string, React.ReactNode> = {
  BUG: <Bug size={12} className="text-red-500" />,
  STORY: <BookOpen size={12} className="text-blue-500" />,
  EPIC: <Zap size={12} className="text-purple-500" />,
  SUBTASK: <Layers size={12} className="text-teal-500" />,
  TASK: <CheckSquare size={12} className="text-indigo-500" />,
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
      className={clsx(
        'group relative flex cursor-pointer flex-col gap-2.5 rounded-xl border bg-[var(--bg-elevated)] p-4 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg',
        isDragging ? 'border-indigo-500 shadow-xl opacity-90 scale-105' : 'border-[var(--border-subtle)] hover:border-[var(--border-hover)]',
        isSelected && 'ring-2 ring-indigo-500 border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20'
      )}
    >
      {/* Selection Checkbox & Drag Handle */}
      <div className="absolute left-2 top-2 z-10 flex flex-col gap-1 items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        {permissions.task.delete && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onToggleSelection?.();
            }}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          />
        )}
      </div>

      {/* Top Row: issue_key + task_type + drag handle */}
      <div className="flex items-center justify-between gap-2 pl-6">
        <div className="flex items-center gap-2">
          {/* Issue Key badge */}
          <span className="text-[11px] font-mono font-semibold text-[var(--text-tertiary)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-1.5 py-0.5 rounded select-none">
            {task.issue_key}
          </span>
          {/* Task Type icon + label */}
          {task.task_type && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">
              {TASK_TYPE_ICONS[task.task_type] || null}
              {TASK_TYPE_LABELS[task.task_type as keyof typeof TASK_TYPE_LABELS] || task.task_type}
            </span>
          )}
        </div>

        {permissions.task.modify && (
          <div
            {...dragListeners}
            onClick={(e) => e.stopPropagation()}
            className="cursor-grab active:cursor-grabbing text-[var(--text-tertiary)] hover:text-indigo-500 -mt-1 -mr-1 p-1 transition-colors"
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
            className="w-full rounded border border-indigo-500 bg-transparent px-1 py-0.5 text-[15px] font-semibold text-[var(--text-primary)] focus:outline-none"
          />
        ) : (
          <h4
            onDoubleClick={handleDoubleClick}
            className="text-[15px] font-semibold text-[var(--text-primary)] leading-tight line-clamp-2"
            title="Kattints duplán a szerkesztéshez"
          >
            {task.summary}
          </h4>
        )}
      </div>

      {/* Meta row: priority badge, story points, due date */}
      <div className="flex flex-wrap items-center gap-2 text-xs mt-1">
        {task.priority && (
          <span className={clsx(
            "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold tracking-wide border",
            PRIORITY_COLORS[task.priority.toUpperCase()] || 'bg-gray-100 text-gray-700 border-gray-200'
          )}>
            {task.priority.toUpperCase()}
          </span>
        )}

        {(task.story_points !== null && task.story_points !== undefined && task.story_points > 0) && (
          <span className="inline-flex items-center justify-center h-6 min-w-[24px] px-1.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border border-indigo-200 text-[11px] font-bold tabular-nums" title="Story Points">
            {task.story_points} SP
          </span>
        )}

        {task.due_at && (
          <div className={clsx(
            "flex items-center gap-1.5 px-2 py-0.5 rounded-md border font-medium",
            isOverdue ? "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/30" :
            isDueSoon ? "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/30" :
            "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-secondary)]"
          )}>
            <Calendar size={12} className={clsx(isOverdue && "text-red-500")} />
            {new Date(task.due_at).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}
          </div>
        )}

        {task.assignee_id && (
          <div className="ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 text-[10px] font-bold text-indigo-800 ring-2 ring-white shadow-sm" title={task.assignee_id}>
            {task.assignee_id.substring(0, 2).toUpperCase()}
          </div>
        )}
      </div>

      {/* Subtask Progress Bar */}
      {subtasksTotal > 0 && (
        <div className="flex items-center gap-2 w-full mt-1" title={`${subtasksCompleted} / ${subtasksTotal} alfeladat kész`}>
          <div className="flex-1 h-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-full overflow-hidden">
            <div 
              className={clsx(
                "h-full transition-all duration-500 ease-out rounded-full",
                subtasksCompleted === subtasksTotal ? "bg-emerald-500" : "bg-indigo-500"
              )}
              style={{ width: `${subtaskPercent}%` }}
            />
          </div>
          <span className="text-[10px] font-bold text-[var(--text-tertiary)] tabular-nums">
            {subtasksCompleted}/{subtasksTotal}
          </span>
        </div>
      )}

      {/* Categories */}
      {task.categories && task.categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[var(--border-subtle)]/50 mt-1">
          {task.categories.map((c) => (
            <span
              key={c.task_category_id}
              style={{backgroundColor: c.color + '15', color: c.color, borderColor: c.color + '30'}}
              className="px-2 py-0.5 text-[10px] uppercase font-bold rounded border border-solid"
            >
              {c.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
