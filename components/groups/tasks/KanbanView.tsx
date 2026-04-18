import {useState, useMemo} from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import {sortableKeyboardCoordinates} from '@dnd-kit/sortable';
import TaskColumn from './TaskColumn';
import TaskCard from './TaskCard';
import {Task, STATUSES, STATUS_LABELS} from './types';

export interface KanbanViewProps {
  tasks: Task[];
  permissions: any;
  onTaskClick: (task: Task) => void;
  selectedTaskIds: string[];
  onToggleSelection: (taskId: string) => void;
  onModifyTaskSummary: (taskId: string, newSummary: string) => void;
  onTaskMove: (taskId: string, newStatus: string) => Promise<void>;
}

export default function KanbanView({
  tasks,
  permissions,
  onTaskClick,
  selectedTaskIds,
  onToggleSelection,
  onModifyTaskSummary,
  onTaskMove
}: KanbanViewProps) {
  // Local state for optimistic drag & drop
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Sync with upstream tasks
  useMemo(() => {
    setLocalTasks(tasks);
  }, [tasks]);

  const activeTask = useMemo(
    () => localTasks.find((t) => t.id === activeId),
    [activeId, localTasks]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const {active, over} = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) return;

    const isActiveTask = active.data.current?.type === 'Task';
    const isOverTask = over.data.current?.type === 'Task';
    const isOverColumn = (STATUSES as readonly string[]).includes(overId);

    if (isActiveTask) {
      setLocalTasks((tasks) => {
        const activeIndex = tasks.findIndex((t) => t.id === activeId);
        let overIndex = -1;

        if (isOverTask) {
          overIndex = tasks.findIndex((t) => t.id === overId);
          // Same column reorder
          if (tasks[activeIndex].status === tasks[overIndex].status) {
             // For simple visual reorder
            const newTasks = [...tasks];
            const [moved] = newTasks.splice(activeIndex, 1);
            newTasks.splice(overIndex, 0, moved);
            return newTasks;
          }
          // Cross column reorder
          const newTasks = [...tasks];
          newTasks[activeIndex] = {...newTasks[activeIndex], status: tasks[overIndex].status};
          const [moved] = newTasks.splice(activeIndex, 1);
          newTasks.splice(overIndex + (activeIndex < overIndex ? -1 : 0), 0, moved);
          return newTasks;
        }

        if (isOverColumn) {
          const newTasks = [...tasks];
          newTasks[activeIndex] = {...newTasks[activeIndex], status: overId};
          return newTasks;
        }

        return tasks;
      });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const {active, over} = event;
    if (!over) {
      setLocalTasks(tasks); // revert
      return;
    }

    const task = localTasks.find(t => t.id === active.id);
    const destinationCol = (STATUSES as readonly string[]).includes(over.id as string) 
      ? over.id as string 
      : over.data.current?.task?.status;

    if (!task || !destinationCol) {
      setLocalTasks(tasks); // revert
      return;
    }

    // Call upstream
    await onTaskMove(task.id, destinationCol);
  };

  const dropAnimationConfig = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: { active: { opacity: '0.4' } },
    }),
  };

  return (
    <div className="flex flex-1 items-start gap-4 overflow-x-auto pb-4 custom-scrollbar">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {STATUSES.map((status) => {
          const colTasks = localTasks.filter((t) => t.status === status);
          return (
            <TaskColumn
              key={status}
              id={status}
              title={STATUS_LABELS[status]}
              tasks={colTasks}
              wipLimit={status === 'IN_PROGRESS' ? 5 : undefined}
              permissions={permissions}
              onTaskClick={onTaskClick}
              selectedTaskIds={selectedTaskIds}
              onToggleSelection={onToggleSelection}
              onModifyTaskSummary={onModifyTaskSummary}
            />
          );
        })}
        
        <DragOverlay dropAnimation={dropAnimationConfig}>
          {activeTask ? (
            <div className="opacity-90 scale-105 pointer-events-none">
              <TaskCard
                task={activeTask}
                permissions={permissions}
                onClick={() => {}}
                isDragging
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
