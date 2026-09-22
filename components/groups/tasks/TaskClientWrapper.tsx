'use client';

import {useState, useEffect, useMemo, useCallback} from 'react';
import {useTranslations} from 'next-intl';
import {Plus, Tags, Filter, Search, Columns3, List, Calendar as CalendarIcon, Trash2, Clock, CalendarRange, Rows3} from 'lucide-react';
import toast from 'react-hot-toast';

import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import Skeleton from '@/components/ui/Skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import AvatarGroup from '@/components/ui/AvatarGroup';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from '@/components/ui/select';

import KanbanView from './KanbanView';
import ListView from './ListView';
import CalendarView from './CalendarView';
import TimelineView from './TimelineView';
import BacklogView from './BacklogView';
import FilterSheet, {FilterState} from './FilterSheet';
import TaskDetailModal from './TaskDetailModal';
import TaskFormModal from './TaskFormModal';
import CategoryManagerModal from './CategoryManagerModal';
import SprintManagerModal from './SprintManagerModal';

import {Task, GroupUser, Sprint} from './types';
import {getTask, getTaskPanel, modifyTask, deleteTask} from '@/lib/api/tasks';
import {getSprintList} from '@/lib/api/sprints';
import {getGroupMembers} from '@/lib/api/groups';
import {parseGroupUsers} from '@/lib/utils/groupUsers';
import {translateTaskApiError} from '@/lib/i18n/tasks';

const BACKLOG_VALUE = '__backlog__';
const ALL_VALUE = '__all__';

export interface TaskClientWrapperProps {
  groupId: string;
  permissions: {
    task: { read: boolean; create: boolean; modify: boolean; delete: boolean };
    category: { read: boolean; create: boolean; modify: boolean; delete: boolean };
    comment: { read: boolean; create: boolean; modify: boolean; delete: boolean };
    sprint: { read: boolean; create: boolean; modify: boolean; delete: boolean; start: boolean; close: boolean };
  };
}

export default function TaskClientWrapper({groupId, permissions}: TaskClientWrapperProps) {
  const t = useTranslations('tasks');
  const [activeView, setActiveView] = useState<'kanban' | 'list' | 'calendar' | 'timeline' | 'backlog'>('kanban');
  const [backlogRefreshKey, setBacklogRefreshKey] = useState(0);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupUsers, setGroupUsers] = useState<GroupUser[]>([]);
  const [groupUsersLoading, setGroupUsersLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [isSprintManagerOpen, setIsSprintManagerOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [sprintContext, setSprintContext] = useState<string>(ALL_VALUE);
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    myTasksOnly: false,
    status: [],
    priority: [],
    dateFrom: '',
    dateTo: '',
    includeArchived: false
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

  const fetchSprints = useCallback(async () => {
    if (!permissions.sprint.read) return;
    try {
      const response = await getSprintList({group_id: groupId, limit: 200});
      const data = response.data?.data || response.data || [];
      const list = Array.isArray(data.sprints) ? data.sprints : Array.isArray(data) ? data : [];
      setSprints(list);
    } catch {
      // Non-critical for the task page.
    }
  }, [groupId, permissions.sprint.read]);

  useEffect(() => {
    fetchSprints();
  }, [fetchSprints]);

  const sprintsById = useMemo(() => {
    const map: Record<string, Sprint> = {};
    sprints.forEach((sprint) => { map[sprint.id] = sprint; });
    return map;
  }, [sprints]);

  const fetchTasks = useCallback(async () => {
    if (!permissions.task.read) return;

    setLoading(true);
    try {
      const sprintFilter: {sprint_id?: string; backlog_only?: boolean} =
        sprintContext === ALL_VALUE ? {} :
        sprintContext === BACKLOG_VALUE ? {backlog_only: true} :
        {sprint_id: sprintContext};

      // Egy lezárt sprint task-jai mind archiváltak — enélkül üres listát adna a szerver.
      const isClosedSprintSelected = sprintContext !== ALL_VALUE && sprintContext !== BACKLOG_VALUE
        && sprintsById[sprintContext]?.status === 'CLOSED';

      const response = await getTaskPanel({
        group_id: groupId,
        page_number: currentPage,
        load_task_number: 100,
        ...sprintFilter,
        // A backend a mezőt false-ra is elutasítja ("Extra inputs are not
        // permitted"), ha nincs rá szükség — csak akkor küldjük, ha true.
        ...(filters.includeArchived || isClosedSprintSelected ? {include_archived: true} : {})
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
  }, [currentPage, groupId, permissions.task.read, sprintContext, sprintsById, filters.includeArchived, t]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Deep link from a `/task` chip in the editor: ?task=<id> opens that task's detail.
  useEffect(() => {
    const taskId = new URLSearchParams(window.location.search).get('task');
    if (!taskId) return;
    getTask({group_id: groupId, task_id: taskId})
      .then(({data}) => setSelectedTask((data?.task ?? data) as Task))
      .catch((error) => toast.error(translateTaskApiError(t, error, 'toasts.loadError')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [sprintContext]);

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

  const hasActiveFilters =
    filters.status.length > 0 ||
    filters.priority.length > 0 ||
    !!filters.dateFrom ||
    !!filters.dateTo ||
    filters.includeArchived;

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-title text-fg">{t('page.title')}</h1>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {permissions.sprint.read && activeView !== 'backlog' && (
            <Select value={sprintContext} onValueChange={setSprintContext}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder={t('sprint.switcherLabel')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>{t('sprint.all')}</SelectItem>
                <SelectItem value={BACKLOG_VALUE}>{t('sprint.backlog')}</SelectItem>
                {sprints.map((sprint) => (
                  <SelectItem key={sprint.id} value={sprint.id}>{sprint.sprint_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {activeView === 'backlog' && groupUsers.length > 0 && (
            <AvatarGroup
              users={groupUsers.map((user) => ({name: user.full_name}))}
              className="hidden sm:flex"
            />
          )}

          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-muted"
              size={16}
            />
            <Input
              type="text"
              placeholder={t('filter.searchPlaceholder')}
              value={filters.search}
              onChange={(event) => setFilters((prev) => ({...prev, search: event.target.value}))}
              className="w-full pl-8 sm:w-48"
            />
          </div>

          <Button
            variant={hasActiveFilters ? 'secondary' : 'ghost'}
            size="sm"
            startIcon={<Filter size={15} />}
            onClick={() => setIsFilterOpen(true)}
          >
            <span className="hidden sm:inline">{t('filter.filterButton')}</span>
          </Button>

          <div className="mx-1 h-5 w-px bg-border" />

          <Tabs value={activeView} onValueChange={(value) => setActiveView(value as typeof activeView)}>
            <TabsList>
              <TabsTrigger value="timeline" className="hidden lg:inline-flex">
                <Clock size={15} /> <span className="hidden sm:inline">{t('views.timeline')}</span>
              </TabsTrigger>
              <TabsTrigger value="kanban" className="hidden lg:inline-flex">
                <Columns3 size={15} /> <span className="hidden sm:inline">{t('views.kanban')}</span>
              </TabsTrigger>
              <TabsTrigger value="backlog">
                <Rows3 size={15} /> <span className="hidden sm:inline">{t('views.backlog')}</span>
              </TabsTrigger>
              <TabsTrigger value="calendar">
                <CalendarIcon size={15} /> <span className="hidden sm:inline">{t('views.calendar')}</span>
              </TabsTrigger>
              <TabsTrigger value="list">
                <List size={15} /> <span className="hidden sm:inline">{t('views.list')}</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {permissions.category.read && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsCategoryManagerOpen(true)}
                    aria-label={t('category.manage')}
                    className="px-2"
                    startIcon={<Tags size={16} />}
                  />
                </TooltipTrigger>
                <TooltipContent>{t('category.manage')}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {permissions.sprint.read && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsSprintManagerOpen(true)}
                    aria-label={t('sprint.manage')}
                    className="px-2"
                    startIcon={<CalendarRange size={16} />}
                  />
                </TooltipTrigger>
                <TooltipContent>{t('sprint.manage')}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {permissions.task.create && (
            <Button
              variant="primary"
              startIcon={<Plus size={16} />}
              onClick={() => setIsFormOpen(true)}
              className="ml-1"
            >
              {t('create')}
            </Button>
          )}
        </div>
      </div>

      {permissions.task.delete && selectedTaskIds.length > 0 && activeView !== 'calendar' && activeView !== 'timeline' && activeView !== 'backlog' && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-surface-1 px-4 py-3 animate-in slide-in-from-top-2">
          <span className="text-sm font-medium text-fg">
            {t('badges.selectedCount', {count: selectedTaskIds.length})}
          </span>
          <Button
            variant="danger"
            size="sm"
            startIcon={<Trash2 size={16} />}
            onClick={handleBulkDelete}
          >
            {t('badges.bulkDelete')}
          </Button>
        </div>
      )}

      <div className="relative flex min-w-0 flex-1 overflow-hidden">
        {activeView === 'backlog' ? (
          <BacklogView
            groupId={groupId}
            permissions={permissions}
            sprints={sprints}
            onSprintsChanged={setSprints}
            onTaskClick={setSelectedTask}
            searchQuery={filters.search}
            onManageSprint={() => setIsSprintManagerOpen(true)}
            refreshKey={backlogRefreshKey}
          />
        ) : loading && tasks.length === 0 ? (
          <div className="flex flex-1 gap-4">
            {[0, 1, 2].map((column) => (
              <div key={column} className="hidden flex-1 flex-col gap-3 lg:flex">
                <Skeleton className="h-6 w-28" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ))}
            <div className="flex flex-1 flex-col gap-3 lg:hidden">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
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
                sprintsById={sprintsById}
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
                sprintsById={sprintsById}
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

      {activeView !== 'backlog' && (
        <div className="mt-2 flex items-center justify-between border-t border-border pt-4">
          <p className="text-sm text-fg-secondary">
            {t('pagination.page')} <span className="font-medium text-fg">{currentPage}</span>{' '}
            {tasks.length > 0 && t('pagination.showing', {count: tasks.length})}
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1 || loading}
            >
              {t('pagination.prev')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentPage((page) => page + 1)}
              disabled={!hasMore || loading}
            >
              {t('pagination.next')}
            </Button>
          </div>
        </div>
      )}

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
          setBacklogRefreshKey((key) => key + 1);
        }}
        groupUsers={groupUsers}
        groupUsersLoading={groupUsersLoading}
        sprints={sprints}
      />

      {isFormOpen && (
        <TaskFormModal
          open={isFormOpen}
          initialData={undefined}
          onClose={() => setIsFormOpen(false)}
          groupId={groupId}
          onSuccess={() => {
            fetchTasks();
            setBacklogRefreshKey((key) => key + 1);
          }}
          groupUsers={groupUsers}
          groupUsersLoading={groupUsersLoading}
          sprints={sprints}
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

      {isSprintManagerOpen && (
        <SprintManagerModal
          open={isSprintManagerOpen}
          onClose={() => setIsSprintManagerOpen(false)}
          groupId={groupId}
          permissions={permissions.sprint}
          onSprintsChanged={setSprints}
        />
      )}
    </div>
  );
}
