'use client';

import {useState, useEffect, useMemo, useCallback} from 'react';
import {useTranslations} from 'next-intl';
import {Plus, Tags, Filter, Search, Columns3, List, Calendar as CalendarIcon, Trash2, Clock} from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

import KanbanView from './KanbanView';
import ListView from './ListView';
import CalendarView from './CalendarView';
import TimelineView from './TimelineView';
import FilterSheet, {FilterState} from './FilterSheet';
import TaskDetailModal from './TaskDetailModal';
import TaskFormModal from './TaskFormModal';
import CategoryManagerModal from './CategoryManagerModal';

import {Task, GroupUser} from './types';
import {getTaskPanel, modifyTask, deleteTask} from '@/lib/api/tasks';
import {getGroupMembers} from '@/lib/api/groups';
import {translateTaskApiError} from '@/lib/i18n/tasks';

const parseGroupUsers = (payload: unknown): GroupUser[] => {
  if (!payload || typeof payload !== 'object') return [];
  const raw = payload as Record<string, unknown>;
  const data = raw.data ?? raw;
  const inner = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
  const arr = inner.data ?? inner.users ?? inner.group_users ?? inner.items ?? (Array.isArray(data) ? data : []);
  if (!Array.isArray(arr)) return [];

  return arr
    .map((item: any): GroupUser | null => {
      if (!item || typeof item !== 'object') return null;
      const user_id = String(item.user_id ?? '').trim();
      if (!user_id) return null;
      return {
        user_id,
        full_name: String(item.full_name ?? item.fullname ?? item.name ?? item.email ?? ''),
        email: String(item.email ?? ''),
        username: String(item.username ?? (item.email ?? '').split('@')[0] ?? '')
      };
    })
    .filter((user): user is GroupUser => user !== null);
};

export interface TaskClientWrapperProps {
  groupId: string;
  permissions: {
    task: { read: boolean; create: boolean; modify: boolean; delete: boolean };
    category: { read: boolean; create: boolean; modify: boolean; delete: boolean };
    comment: { read: boolean; create: boolean; modify: boolean; delete: boolean };
  };
}

export default function TaskClientWrapper({groupId, permissions}: TaskClientWrapperProps) {
  const t = useTranslations('tasks');
  const [activeView, setActiveView] = useState<'kanban' | 'list' | 'calendar' | 'timeline'>('kanban');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupUsers, setGroupUsers] = useState<GroupUser[]>([]);
  const [groupUsersLoading, setGroupUsersLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    myTasksOnly: false,
    status: [],
    priority: [],
    dateFrom: '',
    dateTo: ''
  });

  // Switch to list view on mobile since Kanban/Timeline are hidden
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024 && (activeView === 'kanban' || activeView === 'timeline')) {
        setActiveView('list');
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activeView]);

  const fetchGroupUsers = useCallback(async () => {
    setGroupUsersLoading(true);
    try {
      const response = await getGroupMembers(groupId);
      setGroupUsers(parseGroupUsers(response));
    } catch {
      // Non-critical for the task page.
    } finally {
      setGroupUsersLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchGroupUsers();
  }, [fetchGroupUsers]);

  const fetchTasks = useCallback(async () => {
    if (!permissions.task.read) return;

    setLoading(true);
    try {
      const response = await getTaskPanel({
        group_id: groupId,
        page_number: currentPage,
        load_task_number: 100
      });

      const data = response.data?.data || response.data || {};
      let fetchedTasks: Task[] = [];

      if (Array.isArray(data.tasks)) {
        fetchedTasks = data.tasks.map((task: any) => ({...task, id: task.id || task.task_id}));
        setHasMore(data.current_page < data.total_pages);
      } else if (Array.isArray(data)) {
        fetchedTasks = data.map((task: any) => ({...task, id: task.id || task.task_id}));
        setHasMore(data.length === 100);
      } else {
        setHasMore(false);
      }

      setTasks(fetchedTasks);
    } catch (error) {
      toast.error(translateTaskApiError(t, error, 'toasts.loadError'));
    } finally {
      setLoading(false);
    }
  }, [currentPage, groupId, permissions.task.read, t]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (filters.search && !task.summary.toLowerCase().includes(filters.search.toLowerCase())) return false;
      if (filters.myTasksOnly && task.assigneer_id?.assigneer_email !== 'current_user_email') return false;
      if (filters.status.length > 0 && !filters.status.includes(task.status)) return false;
      if (filters.priority.length > 0 && task.priority && !filters.priority.includes(task.priority)) return false;

      if (task.due_at) {
        const taskDate = new Date(task.due_at).getTime();
        if (filters.dateFrom && taskDate < new Date(filters.dateFrom).getTime()) return false;
        if (filters.dateTo && taskDate > new Date(filters.dateTo).getTime()) return false;
      } else if (filters.dateFrom || filters.dateTo) {
        return false;
      }

      return true;
    });
  }, [filters, tasks]);

  const toggleSelection = (taskId: string) => {
    setSelectedTaskIds((prev) => prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]);
  };

  const handleToggleAll = () => {
    if (selectedTaskIds.length === filteredTasks.length) {
      setSelectedTaskIds([]);
      return;
    }

    setSelectedTaskIds(filteredTasks.map((task) => task.id));
  };

  const handleBulkDelete = async () => {
    if (!permissions.task.delete || selectedTaskIds.length === 0) return;
    if (!window.confirm(t('confirm.bulkDelete', {count: selectedTaskIds.length}))) return;

    try {
      await deleteTask({group_id: groupId, task_id: selectedTaskIds});
      toast.success(t('toasts.bulkDeleteSuccess', {count: selectedTaskIds.length}));
      setSelectedTaskIds([]);
      fetchTasks();
    } catch (error) {
      toast.error(translateTaskApiError(t, error, 'toasts.deleteError'));
    }
  };

  const handleModifySummary = async (taskId: string, newSummary: string) => {
    if (!permissions.task.modify) return;

    try {
      setTasks((prev) => prev.map((task) => task.id === taskId ? {...task, summary: newSummary} : task));
      await modifyTask({group_id: groupId, task_id: taskId, summary: newSummary});
      toast.success(t('toasts.summaryUpdated'));
    } catch (error) {
      toast.error(translateTaskApiError(t, error, 'toasts.updateError'));
      fetchTasks();
    }
  };

  const handleTaskMove = async (taskId: string, newStatus: string) => {
    try {
      setTasks((prev) => prev.map((task) => task.id === taskId ? {...task, status: newStatus} : task));
      await modifyTask({group_id: groupId, task_id: taskId, status: newStatus});
      toast.success(t('toasts.statusUpdated'));
    } catch (error) {
      toast.error(translateTaskApiError(t, error, 'toasts.updateError'));
      fetchTasks();
    }
  };

  const handleTaskScheduleChange = async (taskId: string, changes: {started_at: string; due_at: string | null}) => {
    if (!permissions.task.modify) return;

    const currentTask = tasks.find((task) => task.id === taskId);
    if (!currentTask) return;

    const previousStartedAt = currentTask.started_at ?? currentTask.created_at;
    const previousDueAt = currentTask.due_at ?? null;

    setTasks((prev) => prev.map((task) => (
      task.id === taskId
        ? {...task, started_at: changes.started_at, due_at: changes.due_at}
        : task
    )));

    try {
      await modifyTask({
        group_id: groupId,
        task_id: taskId,
        started_at: changes.started_at,
        due_at: changes.due_at
      });
      toast.success(t('toasts.scheduleUpdated'));
    } catch (error) {
      setTasks((prev) => prev.map((task) => (
        task.id === taskId
          ? {...task, started_at: previousStartedAt, due_at: previousDueAt}
          : task
      )));
      toast.error(translateTaskApiError(t, error, 'toasts.scheduleUpdateError'));
      fetchTasks();
    }
  };

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">{t('page.title')}</h1>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="group relative">
            <Search className="absolute left-2.5 top-2 text-[var(--text-tertiary)] group-focus-within:text-orange-500" size={16} />
            <input
              type="text"
              placeholder={t('filter.searchPlaceholder')}
              value={filters.search}
              onChange={(event) => setFilters((prev) => ({...prev, search: event.target.value}))}
              className="h-9 w-full sm:w-48 rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] pl-8 pr-3 text-sm text-[var(--text-primary)] transition-all focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>

          <button
            onClick={() => setIsFilterOpen(true)}
            className={clsx(
              'flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
              (filters.status.length > 0 || filters.priority.length > 0 || filters.dateFrom || filters.dateTo)
                ? 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-700/50 dark:bg-orange-900/30'
                : 'border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
            )}
          >
            <Filter size={15} /> <span className="hidden sm:inline">{t('filter.filterButton')}</span>
          </button>

          <div className="mx-1 h-4 w-px bg-[var(--border-subtle)]" />

          <div className="flex rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-1 shadow-sm">
            <button
              onClick={() => setActiveView('kanban')}
              className={clsx(
                'hidden lg:flex items-center gap-2 rounded border px-3 py-1.5 text-sm font-medium transition-all',
                activeView === 'kanban'
                  ? 'border-orange-500/50 bg-orange-500/10 text-orange-500 shadow'
                  : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
              )}
            >
              <Columns3 size={15} /> <span className="hidden sm:inline">{t('views.kanban')}</span>
            </button>
            <button
              onClick={() => setActiveView('list')}
              className={clsx('flex items-center gap-2 rounded border px-3 py-1.5 text-sm font-medium transition-all', activeView === 'list' ? 'border-orange-500/50 bg-orange-500/10 text-orange-500 shadow' : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]')}
            >
              <List size={15} /> <span className="hidden sm:inline">{t('views.list')}</span>
            </button>
            <button
              onClick={() => setActiveView('calendar')}
              className={clsx('flex items-center gap-2 rounded border px-3 py-1.5 text-sm font-medium transition-all', activeView === 'calendar' ? 'border-orange-500/50 bg-orange-500/10 text-orange-500 shadow' : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]')}
            >
              <CalendarIcon size={15} /> <span className="hidden sm:inline">{t('views.calendar')}</span>
            </button>
            <button
              onClick={() => setActiveView('timeline')}
              className={clsx(
                'hidden lg:flex items-center gap-2 rounded border px-3 py-1.5 text-sm font-medium transition-all',
                activeView === 'timeline'
                  ? 'border-orange-500/50 bg-orange-500/10 text-orange-500 shadow'
                  : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
              )}
            >
              <Clock size={15} /> <span className="hidden sm:inline">{t('views.timeline')}</span>
            </button>
          </div>

          {permissions.category.read && (
            <button
              onClick={() => setIsCategoryManagerOpen(true)}
              className="flex items-center justify-center rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
              title={t('category.manage')}
            >
              <Tags size={16} />
            </button>
          )}

          {permissions.task.create && (
            <button
              onClick={() => setIsFormOpen(true)}
              className="ml-2 flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-orange-600 hover:shadow-lg hover:shadow-orange-500/20 active:scale-95"
            >
              <Plus size={16} /> <span className="sm:inline">{t('create')}</span>
            </button>
          )}
        </div>
      </div>

      {permissions.task.delete && selectedTaskIds.length > 0 && activeView !== 'calendar' && activeView !== 'timeline' && (
        <div className="animate-in slide-in-from-top-2 flex items-center justify-between rounded-lg bg-orange-50 p-3 px-4 shadow-sm outline outline-1 outline-orange-200 dark:bg-orange-900/30 dark:outline-orange-800">
          <span className="text-sm font-medium text-orange-800 dark:text-orange-300">
            {t('badges.selectedCount', {count: selectedTaskIds.length})}
          </span>
          <button
            onClick={handleBulkDelete}
            className="flex items-center gap-2 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700"
          >
            <Trash2 size={16} /> {t('badges.bulkDelete')}
          </button>
        </div>
      )}

      <div className="relative flex min-w-0 flex-1 overflow-hidden">
        {loading && tasks.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--border-default)] border-t-orange-500" />
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
                onTaskScheduleChange={handleTaskScheduleChange}
                tasks={filteredTasks}
              />
            )}
          </>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-[var(--border-subtle)] pt-4">
        <p className="text-sm text-[var(--text-secondary)]">
          {t('pagination.page')} <span className="font-semibold text-[var(--text-primary)]">{currentPage}</span>{' '}
          {tasks.length > 0 && t('pagination.showing', {count: tasks.length})}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={currentPage === 1 || loading}
            className="rounded-md border border-[var(--border-default)] px-3 py-1.5 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-50"
          >
            {t('pagination.prev')}
          </button>
          <button
            onClick={() => setCurrentPage((page) => page + 1)}
            disabled={!hasMore || loading}
            className="rounded-md border border-[var(--border-default)] px-3 py-1.5 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-50"
          >
            {t('pagination.next')}
          </button>
        </div>
      </div>

      <FilterSheet open={isFilterOpen} onClose={() => setIsFilterOpen(false)} filters={filters} onApplyFilters={setFilters} />

      <TaskDetailModal
        open={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        task={selectedTask}
        groupId={groupId}
        permissions={{task: permissions.task, comment: permissions.comment}}
        onUpdateTask={(updatedTask) => {
          setTasks((prev) => prev.map((task) => task.id === updatedTask.id ? updatedTask : task));
          setSelectedTask(updatedTask);
        }}
        groupUsers={groupUsers}
        groupUsersLoading={groupUsersLoading}
      />

      {isFormOpen && (
        <TaskFormModal
          open={isFormOpen}
          initialData={undefined}
          onClose={() => setIsFormOpen(false)}
          groupId={groupId}
          onSuccess={fetchTasks}
          groupUsers={groupUsers}
          groupUsersLoading={groupUsersLoading}
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
