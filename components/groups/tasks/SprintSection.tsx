'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {useDroppable} from '@dnd-kit/core';
import {SortableContext, verticalListSortingStrategy} from '@dnd-kit/sortable';
import clsx from 'clsx';
import {ChevronDown, ChevronRight, Plus, Rows3} from 'lucide-react';
import {Sprint, Task} from './types';
import BacklogItemRow from './BacklogItemRow';
import BacklogQuickAdd from './BacklogQuickAdd';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';

export const BACKLOG_SECTION_ID = '__BACKLOG_SECTION__';

interface SectionPermissions {
  task: {create: boolean; modify: boolean; delete: boolean};
  sprint: {modify: boolean; create: boolean; start: boolean; close: boolean};
}

export interface SprintSectionProps {
  sectionId: string;
  /** null = the plain Backlog block (no sprint). */
  sprint: Sprint | null;
  tasks: Task[];
  permissions: SectionPermissions;
  onTaskClick: (task: Task) => void;
  onCreateTask: (sectionId: string, summary: string) => Promise<void> | void;
  onStartSprint?: (sprint: Sprint) => void;
  onCloseSprint?: (sprint: Sprint) => void;
  onCreateSprint?: () => void;
  onManageSprint?: () => void;
  defaultCollapsed?: boolean;
}

export default function SprintSection({
  sectionId,
  sprint,
  tasks,
  permissions,
  onTaskClick,
  onCreateTask,
  onStartSprint,
  onCloseSprint,
  onCreateSprint,
  onManageSprint,
  defaultCollapsed = false
}: SprintSectionProps) {
  const t = useTranslations('tasks');
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const {setNodeRef, isOver} = useDroppable({id: sectionId, data: {type: 'Section'}});

  const status = sprint?.status ?? null;
  const hasDates = !sprint || (!!sprint.start_date && !!sprint.end_date);

  const todoCount = tasks.filter((task) => task.status?.toUpperCase() === 'TODO').length;
  const doneCount = tasks.filter((task) => task.status?.toUpperCase() === 'DONE').length;
  const inProgressCount = Math.max(0, tasks.length - todoCount - doneCount);

  const title = sprint ? sprint.sprint_name : t('sprint.backlog');

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface-1">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-3">
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          className="flex shrink-0 items-center justify-center rounded p-0.5 text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
          aria-label={collapsed ? t('backlog.expand') : t('backlog.collapse')}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </button>

        <h3 className="text-section font-medium text-fg">{title}</h3>

        {status === 'ACTIVE' && <Badge variant="info">{t('backlog.activeLabel')}</Badge>}
        {status === 'CLOSED' && <Badge variant="neutral">{t('backlog.closedLabel')}</Badge>}

        {!hasDates && permissions.sprint.modify && (
          <button
            type="button"
            onClick={onManageSprint}
            className="text-caption font-medium text-accent hover:underline"
          >
            {t('backlog.addDates')}
          </button>
        )}

        {sprint && hasDates && (
          <span className="hidden text-caption text-fg-muted md:inline">
            {new Date(sprint.start_date).toLocaleDateString()} – {new Date(sprint.end_date).toLocaleDateString()}
          </span>
        )}

        <span className="hidden text-caption text-fg-muted md:inline">{t('backlog.itemsSuffix', {count: tasks.length})}</span>

        <div className="ml-auto flex items-center gap-2.5">
          {tasks.length > 0 && (
            <div className="hidden items-center gap-1.5 lg:flex">
              <Badge variant="neutral">{todoCount}</Badge>
              <Badge variant="info">{inProgressCount}</Badge>
              <Badge variant="success">{doneCount}</Badge>
            </div>
          )}

          {permissions.task.create && (
            <button
              type="button"
              onClick={() => { setCollapsed(false); setShowQuickAdd(true); }}
              aria-label={t('backlog.createLink')}
              className="flex shrink-0 items-center justify-center rounded-md border border-border p-2 text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg md:hidden"
            >
              <Plus size={15} />
            </button>
          )}

          {sprint && status === 'PLANNED' && permissions.sprint.start && onStartSprint && (
            <Button size="sm" variant="primary" onClick={() => onStartSprint(sprint)}>
              {t('backlog.startSprint')}
            </Button>
          )}

          {sprint && status === 'ACTIVE' && permissions.sprint.close && onCloseSprint && (
            <Button size="sm" variant="secondary" onClick={() => onCloseSprint(sprint)}>
              {t('backlog.closeSprint')}
            </Button>
          )}

          {!sprint && permissions.sprint.create && onCreateSprint && (
            <Button size="sm" variant="secondary" onClick={onCreateSprint}>
              {t('backlog.createSprint')}
            </Button>
          )}
        </div>
      </div>

      {!collapsed && (
        <div ref={setNodeRef} className={clsx('border-t border-border', isOver && 'bg-accent-muted/40')}>
          <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
            {tasks.length === 0 ? (
              <EmptyState icon={<Rows3 size={20} className="text-fg-muted" />} className="m-3">
                {sprint ? t('backlog.emptySprint') : t('backlog.emptyBacklog')}
              </EmptyState>
            ) : (
              tasks.map((task) => (
                <BacklogItemRow key={task.id} task={task} permissions={permissions} onClick={() => onTaskClick(task)} />
              ))
            )}
          </SortableContext>

          {showQuickAdd ? (
            <BacklogQuickAdd
              onCreate={async (summary) => {
                await onCreateTask(sectionId, summary);
                setShowQuickAdd(false);
              }}
            />
          ) : (
            permissions.task.create && (
              <button
                type="button"
                onClick={() => setShowQuickAdd(true)}
                className="hidden w-full items-center gap-1.5 border-t border-border px-3 py-2 text-caption font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg md:flex"
              >
                <Plus size={14} /> {t('backlog.createLink')}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
