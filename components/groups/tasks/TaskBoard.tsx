import {useState, useEffect, useMemo} from 'react';
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
import confetti from 'canvas-confetti';
import {Plus, Tags, Search, Trash2, Filter} from 'lucide-react';
import toast from 'react-hot-toast';

import TaskColumn from './TaskColumn';
import TaskCard from './TaskCard';
import TaskDetailSheet from './TaskDetailSheet';
import TaskFormModal from './TaskFormModal';
import CategoryManagerModal from './CategoryManagerModal';
import {Task} from './types';
import {getTaskPanel, modifyTask, deleteTask} from '@/lib/api/tasks';

const STATUS_COLUMNS = ['TODO', 'IN_PROGRESS', 'DONE'];
const STATUS_LABELS: Record<string, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done'
};

export interface TaskBoardProps {
  groupId: string;
  permissions: {
    task: {
      read: boolean;
      create: boolean;
      modify: boolean;
      delete: boolean;
    };
    category: {
      read: boolean;
      create: boolean;
      modify: boolean;
      delete: boolean;
    };
    comment: {
      read: boolean;
      create: boolean;
      modify: boolean;
      delete: boolean;
    };
  };
}

export default function TaskBoard({groupId, permissions}: TaskBoardProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  
  // Selection and detail state
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editTask, setEditTask] = useState<Task | undefined>(undefined);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);

  // Filtering state
  const [searchQuery, setSearchQuery] = useState('');
  const [myTasksOnly, setMyTasksOnly] = useState(false);

  // Drag and Drop state
  const [activeId, setActiveId] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchTasks = async () => {
    if (!permissions.task.read) return;
    setLoading(true);
    try {
      const res = await getTaskPanel({
        group_id: groupId,
        page_number: currentPage,
        load_task_number: 100,
      });
      
      const data = res.data?.data || res.data || {};
      let fetchedTasks: Task[] = [];

      if (Array.isArray(data.tasks)) {
        fetchedTasks = data.tasks.map((t: any) => ({ ...t, task_id: t.id || t.id }));
        setHasMore(data.current_page < data.total_pages);
      } else if (Array.isArray(data)) {
        // Fallback if data is a direct array
        fetchedTasks = data.map((t: any) => ({ ...t, task_id: t.id || t.id }));
        setHasMore(data.length === 100);
      } else {
        setHasMore(false);
      }
      
      setTasks(fetchedTasks);
    } catch {
      toast.error('Hiba a feladatok betöltésekor');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [groupId, permissions.task.read, currentPage]);

  const activeTask = useMemo(
    () => tasks.find((t) => t.id === activeId),
    [activeId, tasks]
  );

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (searchQuery && !task.summary.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (myTasksOnly && task.assignee_id !== 'current_user_id') {
        // FIXME: Use actual logged in user id here from auth context
        return false;
      }
      return true;
    });
  }, [tasks, searchQuery, myTasksOnly]);

  const triggerConfetti = () => {
    const duration = 2000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 55,
        origin: {x: 0},
        colors: ['#4f46e5', '#10b981', '#f59e0b']
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 55,
        origin: {x: 1},
        colors: ['#4f46e5', '#10b981', '#f59e0b']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  };

  // DND Handlers
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
    const isOverColumn = STATUS_COLUMNS.includes(overId);

    if (isActiveTask) {
      setTasks((tasks) => {
        const activeIndex = tasks.findIndex((t) => t.id === activeId);
        let overIndex = -1;

        if (isOverTask) {
          overIndex = tasks.findIndex((t) => t.id === overId);
          // Same column reorder
          if (tasks[activeIndex].status === tasks[overIndex].status) {
            // Note: Since we don't have an order API, we just reorder locally for UI feel
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
    if (!over) return;

    const task = tasks.find(t => t.id === active.id);
    const destinationCol = STATUS_COLUMNS.includes(over.id as string) 
      ? over.id as string 
      : over.data.current?.task?.status;

    if (!task || !destinationCol) return;

    // We already optimistically moved in handleDragOver, but we need to fire API.
    // We compare with the original state (via another fetch if it fails)
    
    try {
      // Trigger modify only if we actually changed columns
      await modifyTask({group_id: groupId, task_id: task.id, status: destinationCol});
      toast.success('Kártya áthelyezve');
      if (destinationCol === 'DONE') {
        triggerConfetti();
      }
    } catch {
      toast.error('Hiba az áthelyezés során');
      fetchTasks(); // Reload to fix optimistic UI
    }
  };

  // Bulk selection and Actions
  const toggleSelection = (taskId: string) => {
    setSelectedTaskIds(prev =>
      prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
    );
  };

  const handleBulkDelete = async () => {
    if (!permissions.task.delete || selectedTaskIds.length === 0) return;
    
    if (!confirm(`Biztosan törölni szeretnél ${selectedTaskIds.length} feladatot?`)) return;

    try {
      await deleteTask({group_id: groupId, task_id: selectedTaskIds});
      toast.success(`${selectedTaskIds.length} feladat sikeresen törölve`);
      setSelectedTaskIds([]);
      fetchTasks();
    } catch {
      toast.error('Hiba történt a törlés során');
    }
  };

  const handleModifySummary = async (taskId: string, newSummary: string) => {
    if (!permissions.task.modify) return;
    try {
      setTasks(prev => prev.map(t => t.id === taskId ? {...t, summary: newSummary} : t));
      await modifyTask({group_id: groupId, task_id: taskId, summary: newSummary});
      toast.success('Cím módosítva');
    } catch {
      toast.error('Hiba a módosítás során');
      fetchTasks();
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 gap-6 overflow-x-auto pb-4">
        {[1, 2, 3].map((col) => (
          <div key={col} className="flex h-[75vh] w-[320px] shrink-0 flex-col gap-3 rounded-xl bg-[var(--bg-elevated)] p-4 border border-[var(--border-subtle)]">
            <div className="flex justify-between items-center">
               <div className="h-6 w-24 animate-pulse rounded bg-[var(--bg-surface)]" />
               <div className="h-6 w-8 animate-pulse rounded-full bg-[var(--bg-surface)]" />
            </div>
            <div className="flex flex-col gap-3 mt-4">
              {[1, 2].map((card) => (
                <div key={card} className="h-32 w-full animate-pulse rounded-lg bg-[var(--bg-surface)]" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const dropAnimationConfig = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '0.4',
        },
      },
    }),
  };

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">Feladatok</h1>
        
        <div className="flex items-center gap-4">
          {/* Quick Filters */}
          <div className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-1">
            <div className="relative">
              <Search className="absolute left-2.5 top-2 text-[var(--text-tertiary)]" size={16} />
              <input
                type="text"
                placeholder="Keresés..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-48 rounded bg-transparent pl-8 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="h-4 w-px bg-[var(--border-subtle)] mx-1" />
            <button
              onClick={() => setMyTasksOnly(!myTasksOnly)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${myTasksOnly ? 'bg-indigo-100 text-indigo-700' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
            >
              <Filter size={14} /> Csak a sajátom
            </button>
          </div>

          {permissions.category.read && (
            <button
              onClick={() => setIsCategoryManagerOpen(true)}
              className="flex items-center gap-2 rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
            >
              <Tags size={16} /> Címkék kezelése
            </button>
          )}
          {permissions.task.create && (
            <button
              onClick={() => {
                setEditTask(undefined);
                setIsFormOpen(true);
              }}
              className="flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-indigo-700 hover:shadow-lg active:scale-95"
            >
              <Plus size={16} /> Új feladat
            </button>
          )}
        </div>
      </div>

      {permissions.task.delete && selectedTaskIds.length > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-indigo-50 p-3 pr-4 border border-indigo-100 shadow-sm animate-in slide-in-from-top-4">
          <span className="text-sm font-medium text-indigo-800">
            {selectedTaskIds.length} feladat kijelölve
          </span>
          <button
            onClick={handleBulkDelete}
            className="flex items-center gap-2 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700"
          >
            <Trash2 size={16} /> Kijelöltek törlése
          </button>
        </div>
      )}

      <div className="flex flex-1 items-start gap-6 overflow-x-auto pb-4 custom-scrollbar">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          {STATUS_COLUMNS.map((status) => {
            const colTasks = filteredTasks.filter((t) => t.status === status);
            return (
              <TaskColumn
                key={status}
                id={status}
                title={STATUS_LABELS[status]}
                tasks={colTasks}
                wipLimit={status === 'IN_PROGRESS' ? 5 : undefined} // Example WIP limit
                permissions={permissions}
                onTaskClick={(t) => setSelectedTask(t)}
                selectedTaskIds={selectedTaskIds}
                onToggleSelection={toggleSelection}
                onModifyTaskSummary={handleModifySummary}
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

      <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-4 mt-2">
        <p className="text-sm text-[var(--text-secondary)]">
          Oldal: <span className="font-semibold text-[var(--text-primary)]">{currentPage}</span> {tasks.length > 0 && `(${tasks.length} feladat mutatva)`}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1 || loading}
            className="rounded-md border border-[var(--border-default)] px-3 py-1.5 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-50"
          >
            Előző
          </button>
          <button
            onClick={() => setCurrentPage(p => p + 1)}
            disabled={!hasMore || loading}
            className="rounded-md border border-[var(--border-default)] px-3 py-1.5 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-50"
          >
            Következő
          </button>
        </div>
      </div>

      <TaskDetailSheet
        open={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        task={selectedTask}
        groupId={groupId}
        permissions={{task: permissions.task, comment: permissions.comment}}
        onUpdateTask={(updatedTask) => {
          setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
          setSelectedTask(updatedTask);
        }}
      />

      {isFormOpen && (
        <TaskFormModal
          open={isFormOpen}
          initialData={editTask}
          onClose={() => setIsFormOpen(false)}
          groupId={groupId}
          onSuccess={fetchTasks}
        />
      )}

      {isCategoryManagerOpen && (
        <CategoryManagerModal
          open={isCategoryManagerOpen}
          onClose={() => setIsCategoryManagerOpen(false)}
          groupId={groupId}
          permissions={permissions.category}
        />
      )}
    </div>
  );
}

