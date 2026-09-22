import React from 'react';
import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import TaskCard from './TaskCard';
import {Task, Sprint} from './types';

interface SortableTaskCardProps {
  task: Task;
  permissions: any;
  onClick: () => void;
  isSelected?: boolean;
  onToggleSelection?: () => void;
  onModifySummary?: (newSummary: string) => void;
  sprintsById?: Record<string, Sprint>;
}

export default function SortableTaskCard({
  task,
  permissions,
  onClick,
  isSelected,
  onToggleSelection,
  onModifySummary,
  sprintsById
}: SortableTaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: {
      type: 'Task',
      task,
    },
    disabled: !permissions.task.modify,
  });

  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.4 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <TaskCard
        task={task}
        permissions={permissions}
        onClick={onClick}
        dragListeners={listeners}
        isDragging={isDragging}
        isSelected={isSelected}
        onToggleSelection={onToggleSelection}
        onModifySummary={onModifySummary}
        sprintLabel={task.sprint_id ? sprintsById?.[task.sprint_id]?.sprint_name : undefined}
      />
    </div>
  );
}

