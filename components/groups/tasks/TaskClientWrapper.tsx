import {useState, useEffect, useMemo} from 'react';
import {Plus, Tags, Filter, Search, Columns3, List, Calendar as CalendarIcon, Trash2, Clock} from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

import KanbanView from './KanbanView';
import ListView from './ListView';
import CalendarView from './CalendarView';
import TimelineView from './TimelineView';
import FilterSheet, {FilterState} from './FilterSheet';
import TaskDetailSheet from './TaskDetailSheet';
import TaskFormModal from './TaskFormModal';
import CategoryManagerModal from './CategoryManagerModal';

import {Task} from './types';
import {getTaskPanel, modifyTask, deleteTask} from '@/lib/api/tasks';

export interface TaskClientWrapperProps {
  groupId: string;
  permissions: {
    task: { read: boolean; create: boolean; modify: boolean; delete: boolean; };
    category: { read: boolean; create: boolean; modify: boolean; delete: boolean; };
    comment: { read: boolean; create: boolean; modify: boolean; delete: boolean; };
  };
}

export default function TaskClientWrapper({groupId, permissions}: TaskClientWrapperProps) {
  // Views
  const [activeView, setActiveView] = useState<'kanban' | 'list' | 'calendar' | 'timeline'>('kanban');

  // Data
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Modals & Panels
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Selection (List / Kanban)
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  
  // Filters
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    myTasksOnly: false,
    status: [],
    priority: [],
    dateFrom: '',
    dateTo: ''
  });

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
        fetchedTasks = data.tasks.map((t: any) => ({ ...t, id: t.id || t.task_id }));
        setHasMore(data.current_page < data.total_pages);
      } else if (Array.isArray(data)) {
        fetchedTasks = data.map((t: any) => ({ ...t, id: t.id || t.task_id }));
        setHasMore(data.length === 100);
      } else {
        setHasMore(false);
      }
      
      setTasks(fetchedTasks);
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 403) toast.error('Nincs olvasási jogosultságod (403)');
      else if (status === 429) toast.error('Túl sok kérés (429)');
      else toast.error('Hiba a feladatok betöltésekor');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [groupId, permissions.task.read, currentPage]);

  const handleApplyFilters = (newFilters: FilterState) => {
    setFilters(newFilters);
  };

  // Client-side filtering
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (filters.search && !task.summary.toLowerCase().includes(filters.search.toLowerCase())) return false;
      if (filters.myTasksOnly && task.assignee_id !== 'current_user_id') return false; // NOTE: 'current_user_id' should be dynamically fetched if possible
      if (filters.status.length > 0 && !filters.status.includes(task.status)) return false;
      if (filters.priority.length > 0 && task.priority && !filters.priority.includes(task.priority)) return false;
      
      if (task.due_at) {
        const taskDate = new Date(task.due_at).getTime();
        if (filters.dateFrom && taskDate < new Date(filters.dateFrom).getTime()) return false;
        if (filters.dateTo && taskDate > new Date(filters.dateTo).getTime()) return false;
      } else if (filters.dateFrom || filters.dateTo) {
        // Exclude tasks without due date if a date filter is applied
        return false;
      }
      return true;
    });
  }, [tasks, filters]);

  // Bulk Actions
  const toggleSelection = (taskId: string) => {
    setSelectedTaskIds(prev => prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]);
  };

  const handleToggleAll = () => {
    if (selectedTaskIds.length === filteredTasks.length) {
      setSelectedTaskIds([]);
    } else {
      setSelectedTaskIds(filteredTasks.map(t => t.id));
    }
  };

  const handleBulkDelete = async () => {
    if (!permissions.task.delete || selectedTaskIds.length === 0) return;
    if (!confirm(`Biztosan törölni szeretnél ${selectedTaskIds.length} feladatot?`)) return;

    try {
      await deleteTask({group_id: groupId, task_id: selectedTaskIds});
      toast.success(`${selectedTaskIds.length} feladat sikeresen törölve`);
      setSelectedTaskIds([]);
      fetchTasks();
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 403) toast.error('Nincs törlési jogosultságod (403)');
      else if (status === 422) toast.error('Hibás kérés (422)');
      else if (status === 429) toast.error('Túl sok kérés (429)');
      else toast.error('Hiba történt a törlés során');
    }
  };

  // Inline Actions
  const handleModifySummary = async (taskId: string, newSummary: string) => {
    if (!permissions.task.modify) return;
    try {
      setTasks(prev => prev.map(t => t.id === taskId ? {...t, summary: newSummary} : t));
      await modifyTask({group_id: groupId, task_id: taskId, summary: newSummary});
      toast.success('Cím módosítva');
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 403) toast.error('Nincs módosítási jogosultságod (403)');
      else if (status === 422) toast.error('Érvénytelen adatok (422)');
      else if (status === 429) toast.error('Túl sok kérés (429)');
      else toast.error('Hiba a módosítás során');
      fetchTasks();
    }
  };

  const handleTaskMove = async (taskId: string, newStatus: string) => {
    try {
      // Optimistic locally handled by KanbanView, but we sync root state
      setTasks(prev => prev.map(t => t.id === taskId ? {...t, status: newStatus} : t));
      await modifyTask({group_id: groupId, task_id: taskId, status: newStatus});
      toast.success('Státusz módosítva');
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 403) toast.error('Nincs jogosultságod a státusz módosításához (403)');
      else if (status === 422) toast.error('Érvénytelen kérés (422)');
      else toast.error('Hiba az áthelyezés során');
      fetchTasks();
    }
  };

  return (
    <div className="flex h-full flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">Feladatok</h1>
        
        <div className="flex items-center gap-3">
          {/* Global Search inside Header */}
          <div className="relative group">
            <Search className="absolute left-2.5 top-2 text-[var(--text-tertiary)] group-focus-within:text-indigo-500" size={16} />
            <input
              type="text"
              placeholder="Gyorskeresés..."
              value={filters.search}
              onChange={(e) => handleApplyFilters({...filters, search: e.target.value})}
              className="h-8 w-48 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] pl-8 pr-3 text-sm text-[var(--text-primary)] focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>

          <button
            onClick={() => setIsFilterOpen(true)}
            className={clsx(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors border",
              (filters.status.length > 0 || filters.priority.length > 0 || filters.dateFrom || filters.dateTo) 
                ? "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:border-indigo-700/50" 
                : "border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] bg-[var(--bg-elevated)]"
            )}
          >
            <Filter size={15} /> Szűrők
          </button>

          <div className="h-4 w-px bg-[var(--border-subtle)] mx-1" />

          {/* View Toggles */}
          <div className="flex rounded-md bg-[var(--bg-elevated)] p-1 border border-[var(--border-subtle)] shadow-sm">
            <button
              onClick={() => setActiveView('kanban')}
              className={clsx("p-1.5 px-3 flex gap-2 items-center rounded text-sm font-medium transition-all", activeView === 'kanban' ? "bg-white dark:bg-zinc-800 shadow text-indigo-600 dark:text-indigo-400" : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]")}
            >
              <Columns3 size={15} /> <span className="hidden sm:inline">Kanban</span>
            </button>
            <button
              onClick={() => setActiveView('list')}
              className={clsx("p-1.5 px-3 flex gap-2 items-center rounded text-sm font-medium transition-all", activeView === 'list' ? "bg-white dark:bg-zinc-800 shadow text-indigo-600 dark:text-indigo-400" : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]")}
            >
              <List size={15} /> <span className="hidden sm:inline">Lista</span>
            </button>
            <button
              onClick={() => setActiveView('calendar')}
              className={clsx("p-1.5 px-3 flex gap-2 items-center rounded text-sm font-medium transition-all", activeView === 'calendar' ? "bg-white dark:bg-zinc-800 shadow text-indigo-600 dark:text-indigo-400" : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]")}
            >
              <CalendarIcon size={15} /> <span className="hidden sm:inline">Naptár</span>
            </button>
            <button
              onClick={() => setActiveView('timeline')}
              className={clsx("p-1.5 px-3 flex gap-2 items-center rounded text-sm font-medium transition-all", activeView === 'timeline' ? "bg-white dark:bg-zinc-800 shadow text-indigo-600 dark:text-indigo-400" : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]")}
            >
              <Clock size={15} /> <span className="hidden sm:inline">Idővonal</span>
            </button>
          </div>

          {permissions.category.read && (
            <button
              onClick={() => setIsCategoryManagerOpen(true)}
              className="flex items-center justify-center p-2 rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
              title="Címkék kezelése"
            >
              <Tags size={16} />
            </button>
          )}

          {permissions.task.create && (
            <button
              onClick={() => setIsFormOpen(true)}
              className="flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-indigo-700 hover:shadow-lg active:scale-95 ml-2"
            >
              <Plus size={16} /> Új feladat
            </button>
          )}
        </div>
      </div>

      {permissions.task.delete && selectedTaskIds.length > 0 && activeView !== 'calendar' && activeView !== 'timeline' && (
        <div className="flex items-center justify-between rounded-lg bg-indigo-50 dark:bg-indigo-900/30 p-3 px-4 outline outline-1 outline-indigo-200 dark:outline-indigo-800 shadow-sm animate-in slide-in-from-top-2">
          <span className="text-sm font-medium text-indigo-800 dark:text-indigo-300">
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

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden relative">
        {loading && tasks.length === 0 ? (
           <div className="flex flex-1 items-center justify-center">
             <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--border-default)] border-t-indigo-600" />
           </div>
        ) : (
          <>
            {activeView === 'kanban' && (
              <KanbanView 
                tasks={filteredTasks} 
                permissions={permissions} 
                onTaskClick={setSelectedTask} 
                selectedTaskIds={selectedTaskIds}
                onToggleSelection={toggleSelection}
                onModifyTaskSummary={handleModifySummary}
                onTaskMove={handleTaskMove}
              />
            )}
            {activeView === 'list' && (
              <ListView 
                tasks={filteredTasks}
                permissions={permissions}
                onTaskClick={setSelectedTask}
                selectedTaskIds={selectedTaskIds}
                onToggleSelection={toggleSelection}
                onToggleAll={handleToggleAll}
              />
            )}
            {activeView === 'calendar' && (
              <CalendarView 
                tasks={filteredTasks}
                permissions={permissions}
                onTaskClick={setSelectedTask}
              />
            )}
            {activeView === 'timeline' && (
              <TimelineView 
                groupId={groupId}
                permissions={permissions}
                onTaskClick={setSelectedTask}
                tasks={filteredTasks}
              />
            )}
          </>
        )}
      </div>

      {/* Pagination (Common) */}
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

      {/* Panels and Modals */}
      <FilterSheet 
        open={isFilterOpen} 
        onClose={() => setIsFilterOpen(false)} 
        filters={filters} 
        onApplyFilters={handleApplyFilters} 
      />

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
          initialData={undefined}
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
