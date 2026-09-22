'use client';

import {useCallback, useEffect, useMemo, useState} from 'react';
import {useTranslations} from 'next-intl';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  closestCorners,
  useSensor,
  useSensors,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import {sortableKeyboardCoordinates} from '@dnd-kit/sortable';
import toast from 'react-hot-toast';
import {Sprint, Task} from './types';
import SprintSection, {BACKLOG_SECTION_ID} from './SprintSection';
import BacklogItemRow from './BacklogItemRow';
import Skeleton from '@/components/ui/Skeleton';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import {getTaskPanel, createTask, modifyTask} from '@/lib/api/tasks';
import {createSprint, startSprint, closeSprint} from '@/lib/api/sprints';
import {translateTaskApiError} from '@/lib/i18n/tasks';

export interface BacklogViewProps {
  groupId: string;
  permissions: {
    task: {read: boolean; create: boolean; modify: boolean; delete: boolean};
    sprint: {read: boolean; create: boolean; modify: boolean; delete: boolean; start: boolean; close: boolean};
  };
  sprints: Sprint[];
  onSprintsChanged: (sprints: Sprint[]) => void;
  onTaskClick: (task: Task) => void;
  searchQuery?: string;
  onManageSprint: () => void;
  /** Bump this to force a refetch after a task changed outside this view (e.g. detail modal). */
  refreshKey?: number;
}

export default function BacklogView({
  groupId,
  permissions,
  sprints,
  onSprintsChanged,
  onTaskClick,
  searchQuery,
  onManageSprint,
  refreshKey
}: BacklogViewProps) {
  const t = useTranslations('tasks');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [closeSprintTarget, setCloseSprintTarget] = useState<Sprint | null>(null);

  const fetchAllTasks = useCallback(async () => {
    if (!permissions.task.read) return;
    setLoading(true);
    try {
      // Backend caps load_task_number at 100 — page through everything.
      const PAGE_SIZE = 100;
      const MAX_PAGES = 20;
      let allTasks: Task[] = [];
      let page = 1;
      let totalPages = 1;

      do {
        const response = await getTaskPanel({group_id: groupId, page_number: page, load_task_number: PAGE_SIZE});
        const data = response.data?.data || response.data || {};
        const pageTasks: Task[] = Array.isArray(data.tasks)
          ? data.tasks.map((task: any) => ({...task, id: task.id || task.task_id}))
          : Array.isArray(data)
            ? data.map((task: any) => ({...task, id: task.id || task.task_id}))
            : [];

        allTasks = allTasks.concat(pageTasks);
        totalPages = typeof data.total_pages === 'number' ? data.total_pages : 1;
        page += 1;
      } while (page <= totalPages && page <= MAX_PAGES);

      setTasks(allTasks);
    } catch (error) {
      toast.error(translateTaskApiError(t, error, 'toasts.loadError'));
    } finally {
      setLoading(false);
    }
  }, [groupId, permissions.task.read, t]);

  useEffect(() => {
    fetchAllTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchAllTasks, refreshKey]);

  const filteredTasks = useMemo(() => {
    // CLOSED sprintekhez tartozó (garantáltan DONE) task-ok archívumként a
    // lezárt sprint riport nézetébe valók, nem a backlog táblára.
    const visibleTasks = tasks.filter((task) => task.location !== 'SPRINT');
    if (!searchQuery) return visibleTasks;
    const query = searchQuery.toLowerCase();
    return visibleTasks.filter((task) => task.summary.toLowerCase().includes(query));
  }, [tasks, searchQuery]);

  const sortedSprints = useMemo(
    () =>
      sprints
        .filter((sprint) => sprint.status !== 'CLOSED')
        .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()),
    [sprints]
  );

  const groupedTasks = useMemo(() => {
    const map = new Map<string, Task[]>();
    sortedSprints.forEach((sprint) => map.set(sprint.id, []));
    map.set(BACKLOG_SECTION_ID, []);

    filteredTasks.forEach((task) => {
      const key = task.sprint_id && map.has(task.sprint_id) ? task.sprint_id : BACKLOG_SECTION_ID;
      map.get(key)!.push(task);
    });

    return map;
  }, [filteredTasks, sortedSprints]);

  const activeTask = useMemo(() => tasks.find((task) => task.id === activeId) ?? null, [tasks, activeId]);

  const sensors = useSensors(
    useSensor(PointerSensor, {activationConstraint: {distance: 5}}),
    useSensor(KeyboardSensor, {coordinateGetter: sortableKeyboardCoordinates})
  );

  const moveTaskToSection = async (taskId: string, sectionId: string) => {
    const targetSprintId = sectionId === BACKLOG_SECTION_ID ? null : sectionId;
    const task = tasks.find((item) => item.id === taskId);
    if (!task || (task.sprint_id ?? null) === targetSprintId) return;

    const previousSprintId = task.sprint_id ?? null;
    setTasks((prev) => prev.map((item) => (item.id === taskId ? {...item, sprint_id: targetSprintId} : item)));

    try {
      await modifyTask({
        group_id: groupId,
        task_id: taskId,
        ...(targetSprintId ? {sprint_id: targetSprintId} : {unassign_sprint: true})
      });
      // A szerver oldali sprint-hozzárendelés hatással van a task `location`
      // mezőjére is (pl. aktív sprintnél BOTH-ra vált) — az optimista update
      // ezt nem tudja kiszámolni, ezért a valódi állapotot friss lekéréssel
      // erősítjük meg, hogy a task biztosan a helyes szekcióban jelenjen meg.
      await fetchAllTasks();
    } catch (error) {
      setTasks((prev) => prev.map((item) => (item.id === taskId ? {...item, sprint_id: previousSprintId} : item)));
      toast.error(translateTaskApiError(t, error, 'toasts.updateError'));
    }
  };

  const handleDragStart = (event: DragStartEvent) => setActiveId(event.active.id as string);

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const {active, over} = event;
    if (!over) return;

    const overData = over.data.current as {type?: string; task?: Task} | undefined;
    const targetSectionId =
      overData?.type === 'Section'
        ? (over.id as string)
        : overData?.task?.sprint_id ?? BACKLOG_SECTION_ID;

    await moveTaskToSection(active.id as string, targetSectionId || BACKLOG_SECTION_ID);
  };

  const handleCreateTask = async (sectionId: string, summary: string) => {
    if (!permissions.task.create) return;
    try {
      await createTask({
        group_id: groupId,
        summary,
        issue_key: `TASK-${Math.floor(Math.random() * 10000)}`,
        task_type: 'STORY',
        status: 'TODO',
        priority: 'MEDIUM',
        ...(sectionId !== BACKLOG_SECTION_ID ? {sprint_id: sectionId} : {})
      });
      // A create válasz nem mindig hordozza megbízhatóan a sprint_id/location
      // mezőt, emiatt a helyi beszúrás rossz szekcióba (backlog) rakhatja az
      // új task-ot — friss lekéréssel biztosítjuk a valódi, szerver oldali állapotot.
      await fetchAllTasks();
      toast.success(t('toasts.createSuccess'));
    } catch (error) {
      toast.error(translateTaskApiError(t, error, 'toasts.updateError'));
    }
  };

  const handleStartSprint = async (sprint: Sprint) => {
    if (!permissions.sprint.start) return;

    try {
      const response = await startSprint({group_id: groupId, sprint_id: sprint.id});
      const updated = response.data?.data || response.data;
      onSprintsChanged(sprints.map((item) => (item.id === sprint.id ? {...item, ...updated} : item)));
      toast.success(t('sprint.startSuccess'));
    } catch (error) {
      toast.error(translateTaskApiError(t, error, 'sprint.startError'));
    }
  };

  const handleCloseSprint = (sprint: Sprint) => {
    if (!permissions.sprint.close) return;
    setCloseSprintTarget(sprint);
  };

  const executeCloseSprint = async () => {
    const sprint = closeSprintTarget;
    if (!sprint) return;
    setCloseSprintTarget(null);

    try {
      const response = await closeSprint({group_id: groupId, sprint_id: sprint.id});
      const data = response.data?.data || response.data || {};
      const unassignedIds: string[] = Array.isArray(data.unassigned_task_ids) ? data.unassigned_task_ids : [];
      // A sprintben maradt kész (DONE) task-ok lezáráskor automatikusan archiválódnak is
      // (is_archived: true) — a task/panel alapból nem adja vissza őket, ezért ezeket
      // helyben is eltávolítjuk a betöltött listából, hogy ne maradjanak a UI-ban.
      const archivedIds: string[] = Array.isArray(data.archived_task_ids) ? data.archived_task_ids : [];

      onSprintsChanged(sprints.map((item) => (item.id === sprint.id ? {...item, status: 'CLOSED', closed_at: new Date().toISOString()} : item)));
      setTasks((prev) => prev
        .filter((task) => !archivedIds.includes(task.id))
        .map((task) => (unassignedIds.includes(task.id) ? {...task, sprint_id: null, location: 'BACKLOG'} : task)));

      toast.success(t('sprint.closeSuccess', {count: unassignedIds.length}));
    } catch (error) {
      toast.error(translateTaskApiError(t, error, 'sprint.closeError'));
    }
  };

  const handleCreateSprint = async () => {
    if (!permissions.sprint.create) return;
    const start = new Date();
    const end = new Date(start.getTime() + 14 * 24 * 60 * 60 * 1000);

    try {
      const response = await createSprint({
        group_id: groupId,
        sprint_name: t('backlog.newSprintName', {count: sprints.length + 1}),
        start_date: start.toISOString(),
        end_date: end.toISOString()
      });
      const created = response.data?.data || response.data;
      onSprintsChanged([...sprints, created]);
      toast.success(t('sprint.createSuccess'));
    } catch (error) {
      toast.error(translateTaskApiError(t, error, 'sprint.createError'));
    }
  };

  const dropAnimationConfig = {
    sideEffects: defaultDropAnimationSideEffects({styles: {active: {opacity: '0.4'}}})
  };

  if (loading && tasks.length === 0) {
    return (
      <div className="flex w-full flex-col gap-3">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex w-full flex-col gap-4 overflow-y-auto pb-4">
        {sortedSprints.map((sprint) => (
          <SprintSection
            key={sprint.id}
            sectionId={sprint.id}
            sprint={sprint}
            tasks={groupedTasks.get(sprint.id) ?? []}
            permissions={permissions}
            onTaskClick={onTaskClick}
            onCreateTask={handleCreateTask}
            onStartSprint={handleStartSprint}
            onCloseSprint={handleCloseSprint}
            onManageSprint={onManageSprint}
          />
        ))}

        <SprintSection
          sectionId={BACKLOG_SECTION_ID}
          sprint={null}
          tasks={groupedTasks.get(BACKLOG_SECTION_ID) ?? []}
          permissions={permissions}
          onTaskClick={onTaskClick}
          onCreateTask={handleCreateTask}
          onCreateSprint={handleCreateSprint}
          onManageSprint={onManageSprint}
        />
      </div>

      <DragOverlay dropAnimation={dropAnimationConfig}>
        {activeTask ? (
          <div className="pointer-events-none w-full max-w-xl scale-[1.01] rounded-lg opacity-90 shadow-lg">
            <BacklogItemRow task={activeTask} permissions={permissions} onClick={() => {}} />
          </div>
        ) : null}
      </DragOverlay>

      <ConfirmDialog
        open={!!closeSprintTarget}
        title={t('backlog.closeSprint')}
        message={closeSprintTarget ? t('sprint.closeConfirm', {name: closeSprintTarget.sprint_name}) : ''}
        onCancel={() => setCloseSprintTarget(null)}
        onConfirm={executeCloseSprint}
        confirmLabel={t('backlog.closeSprint')}
        cancelLabel={t('sprint.cancel')}
      />
    </DndContext>
  );
}
