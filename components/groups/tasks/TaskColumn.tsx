import {useState} from 'react';
import {useDroppable} from '@dnd-kit/core';
import {SortableContext, verticalListSortingStrategy} from '@dnd-kit/sortable';
import {ChevronDown, ChevronRight, MoreHorizontal} from 'lucide-react';
import clsx from 'clsx';
import {Task} from './types';
import SortableTaskCard from './SortableTaskCard';

export interface TaskColumnProps {
  id: string; // The column status name
  title: string;
  tasks: Task[];
  wipLimit?: number;
  permissions: any;
  onTaskClick: (task: Task) => void;
  selectedTaskIds: string[];
  onToggleSelection: (taskId: string) => void;
  onModifyTaskSummary: (taskId: string, newSummary: string) => void;
}

export default function TaskColumn({
  id,
  title,
  tasks,
  wipLimit,
  permissions,
  onTaskClick,
  selectedTaskIds,
  onToggleSelection,
  onModifyTaskSummary
}: TaskColumnProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const {setNodeRef, isOver} = useDroppable({id});

  const isOverWip = wipLimit !== undefined && tasks.length > wipLimit;

  // Calculate story points if we had them, currently just card count
  const footerSummary = `${tasks.length} feladat`;

  if (isCollapsed) {
    return (
      <div className="flex h-[75vh] w-12 shrink-0 flex-col items-center gap-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-4 transition-colors">
        <button
          onClick={() => setIsCollapsed(false)}
          className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <ChevronRight size={20} />
        </button>
        <div className="flex flex-1 items-start justify-center pt-4" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
          <h3 className="font-semibold tracking-wider text-[var(--text-primary)]">{title}</h3>
        </div>
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-xs font-semibold text-[var(--text-secondary)]">
          {tasks.length}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        "flex h-[75vh] w-[320px] shrink-0 flex-col gap-4 rounded-xl border p-4 transition-colors",
        isOver
          ? "border-indigo-500 bg-[rgba(79,70,229,0.05)]"
          : "border-[var(--border-subtle)] bg-[var(--bg-surface)]",
        isOverWip && !isOver && "border-red-400/50 bg-red-500-[0.02]"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex flex-1 items-center gap-2">
          <button
            onClick={() => setIsCollapsed(true)}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <ChevronDown size={18} />
          </button>
          <h3 className={clsx("font-semibold", isOverWip ? "text-red-500" : "text-[var(--text-primary)]")}>
            {title}
          </h3>
          <span
            className={clsx(
              "flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-semibold",
              isOverWip
                ? "bg-red-500/10 text-red-600"
                : "bg-[var(--bg-elevated)] text-[var(--text-secondary)]"
            )}
          >
            {tasks.length}
          </span>
        </div>
        <button className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
          <MoreHorizontal size={18} />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
        <SortableContext items={tasks.map((t) => t.task_id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <SortableTaskCard
              key={task.task_id}
              task={task}
              permissions={permissions}
              onClick={() => onTaskClick(task)}
              isSelected={selectedTaskIds.includes(task.task_id)}
              onToggleSelection={() => onToggleSelection(task.task_id)}
              onModifySummary={(newSummary) => onModifyTaskSummary(task.task_id, newSummary)}
            />
          ))}
        </SortableContext>
        
        {tasks.length === 0 && (
          <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-[var(--border-default)] text-sm text-[var(--text-tertiary)]">
            Nincsenek feladatok
          </div>
        )}
      </div>

      <div className="flex justify-between border-t border-[var(--border-subtle)] pt-3 text-xs text-[var(--text-tertiary)]">
        <span>{footerSummary}</span>
        {isOverWip && <span className="text-red-500 font-medium">Limit túllépve!</span>}
      </div>
    </div>
  );
}
