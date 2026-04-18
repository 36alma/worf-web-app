import {useState, useEffect, useRef} from 'react';
import {Calendar, GripVertical, CheckSquare} from 'lucide-react';
import clsx from 'clsx';
import {Task} from './types';

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

  return (
    <div
      onClick={!isEditing ? onClick : undefined}
      className={clsx(
        'group relative flex cursor-pointer flex-col gap-3 rounded-xl border bg-[var(--bg-elevated)] p-4 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg',
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

      <div className="flex items-start justify-between gap-2 pl-6">
        {isEditing ? (
          <input
            ref={inputRef}
            value={editSummary}
            onChange={(e) => setEditSummary(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 rounded border border-indigo-500 bg-transparent px-1 py-0.5 text-[15px] font-semibold text-[var(--text-primary)] focus:outline-none"
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

      <div className="flex flex-wrap items-center gap-2 text-xs mt-1">
        {task.priority && (
          <span className={clsx(
            "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold tracking-wide border",
            (task.priority.toLowerCase() === 'high' || task.priority.toLowerCase() === 'urgent') ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30' :
            (task.priority.toLowerCase() === 'medium' || task.priority.toLowerCase() === 'normal') ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30' :
            'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30'
          )}>
            {task.priority.toUpperCase()}
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

        {(task.subtasks_total ?? 0) > 0 && (
          <div className={clsx(
            "flex items-center gap-1.5 px-2 py-0.5 rounded-md border font-bold text-xs tracking-wide",
            task.subtasks_completed === task.subtasks_total 
              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30" 
              : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-secondary)]"
          )}>
            <CheckSquare size={13} className={clsx(task.subtasks_completed === task.subtasks_total ? "text-emerald-600" : "text-[var(--text-tertiary)]")} />
            {task.subtasks_completed || 0}/{task.subtasks_total}
          </div>
        )}

        {task.assignee_id && (
          <div className="ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 text-[10px] font-bold text-indigo-800 ring-2 ring-white shadow-sm" title={task.assignee_id}>
            {task.assignee_id.substring(0, 2).toUpperCase()}
          </div>
        )}
      </div>

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
