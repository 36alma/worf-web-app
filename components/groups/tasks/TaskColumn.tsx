import {useState} from 'react';
import {useDroppable} from '@dnd-kit/core';
import {SortableContext, verticalListSortingStrategy} from '@dnd-kit/sortable';
import {ChevronDown, ChevronRight, MoreHorizontal} from 'lucide-react';
import clsx from 'clsx';
import {useTranslations} from 'next-intl';
import {Task} from './types';
import SortableTaskCard from './SortableTaskCard';
import EmptyState from '@/components/ui/EmptyState';

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

// Column status → dot colour (spec §5 column header).
const STATUS_DOT: Record<string, string> = {
  TODO: 'var(--text-tertiary)',
  IN_PROGRESS: 'var(--warning)',
  IN_REVIEW: 'var(--info)',
  DONE: 'var(--success)',
  BLOCKED: 'var(--error)',
};

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
  const t = useTranslations('tasks');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const {setNodeRef, isOver} = useDroppable({id});

  const isOverWip = wipLimit !== undefined && tasks.length > wipLimit;
  const dotColor = STATUS_DOT[id?.toUpperCase()] ?? 'var(--text-tertiary)';

  if (isCollapsed) {
    return (
      <div className="flex h-[70svh] w-12 shrink-0 flex-col items-center gap-4 rounded-lg border border-border bg-surface-1 py-4 transition-colors">
        <button
          onClick={() => setIsCollapsed(false)}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center text-fg-secondary hover:text-fg"
          aria-label={title}
        >
          <ChevronRight size={20} />
        </button>
        <div className="flex flex-1 items-start justify-center pt-4" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
          <h3 className="font-medium tracking-wider text-fg">{title}</h3>
        </div>
        <span className="flex size-6 items-center justify-center rounded-full bg-surface-2 text-caption font-medium text-fg-secondary">
          {tasks.length}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        'flex h-[70svh] w-full shrink-0 flex-col gap-4 rounded-lg border p-4 transition-colors lg:h-[75vh] lg:w-[320px]',
        isOver ? 'border-accent bg-accent/5' : 'border-border bg-surface-1',
        isOverWip && !isOver && 'border-danger/50 bg-danger/5'
      )}
    >
      {/* Sticky column header: dot + label + faint count (spec §5) */}
      <div className="sticky top-0 z-10 flex items-center justify-between bg-surface-1 pb-2">
        <div className="flex flex-1 items-center gap-2">
          <button
            onClick={() => setIsCollapsed(true)}
            className="text-fg-secondary hover:text-fg"
            aria-label={title}
          >
            <ChevronDown size={16} />
          </button>
          <span
            className="size-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: dotColor }}
            aria-hidden
          />
          <h3 className={clsx('text-section', isOverWip ? 'text-danger' : 'text-fg')}>{title}</h3>
          <span
            className={clsx('text-caption tabular-nums', isOverWip ? 'text-danger' : 'text-fg-muted')}
          >
            {tasks.length}
          </span>
        </div>
        <button className="text-fg-muted hover:text-fg" aria-label="Column actions">
          <MoreHorizontal size={16} />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
        <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <SortableTaskCard
              key={task.id}
              task={task}
              permissions={permissions}
              onClick={() => onTaskClick(task)}
              isSelected={selectedTaskIds.includes(task.id)}
              onToggleSelection={() => onToggleSelection(task.id)}
              onModifySummary={(newSummary) => onModifyTaskSummary(task.id, newSummary)}
            />
          ))}
        </SortableContext>

        {tasks.length === 0 && <EmptyState>{t('board.emptyColumn')}</EmptyState>}
      </div>

      <div className="flex justify-between border-t border-border pt-3 text-caption text-fg-muted">
        <span>{t('board.taskCount', {count: tasks.length})}</span>
        {isOverWip && <span className="font-medium text-danger">{t('board.wipExceeded')}</span>}
      </div>
    </div>
  );
}
