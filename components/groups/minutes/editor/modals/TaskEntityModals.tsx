'use client';

import {useEffect, useRef, useState} from 'react';
import TaskFormModal from '@/components/groups/tasks/TaskFormModal';
import TaskDetailModal from '@/components/groups/tasks/TaskDetailModal';
import type {GroupUser, Sprint, Task} from '@/components/groups/tasks/types';
import {useGroupPermission} from '@/components/providers/GroupPermissionContext';
import {getGroupMembers} from '@/lib/api/groups';
import {getSprintList} from '@/lib/api/sprints';
import {getTask} from '@/lib/api/tasks';
import {parseGroupUsers} from '@/lib/utils/groupUsers';
import type {ChipRef} from '../entities';
import {useOpenErrorToast, type EntityHostProps} from './shared';

/** The task pages' own modals: `TaskFormModal` to create/edit, `TaskDetailModal` to open a chip. */
export default function TaskEntityModals({ctx, request, onDone}: EntityHostProps) {
  const {groupId} = ctx;
  const {hasPermission} = useGroupPermission();
  const reportOpenError = useOpenErrorToast();
  const createdRef = useRef<ChipRef[]>([]);

  const [groupUsers, setGroupUsers] = useState<GroupUser[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [lookupsReady, setLookupsReady] = useState(false);
  const [task, setTask] = useState<Task | null>(null);

  const canReadSprints = hasPermission('group.sprint.read');
  const taskId = request.mode === 'modify' ? request.item.id : request.mode === 'view' ? request.ref.id : null;

  // Assignee / sprint options. The form is only mounted once they are here: it resets itself whenever
  // `groupUsers` changes, which would wipe what the user already typed.
  useEffect(() => {
    let mounted = true;
    const members = getGroupMembers(groupId)
      .then((response) => mounted && setGroupUsers(parseGroupUsers(response)))
      .catch(() => undefined);
    const sprintList = canReadSprints
      ? getSprintList({group_id: groupId, limit: 200})
          .then((response) => {
            const data = response.data?.data || response.data || [];
            const list = Array.isArray(data.sprints) ? data.sprints : Array.isArray(data) ? data : [];
            if (mounted) setSprints(list);
          })
          .catch(() => undefined)
      : Promise.resolve();
    void Promise.all([members, sprintList]).then(() => mounted && setLookupsReady(true));
    return () => {
      mounted = false;
    };
  }, [groupId, canReadSprints]);

  useEffect(() => {
    if (!taskId) return;
    let mounted = true;
    getTask({group_id: groupId, task_id: taskId})
      .then(({data}) => {
        if (!mounted) return;
        const loaded = (data?.task ?? data) as Task & {task_id?: string};
        setTask({...loaded, id: loaded.id || loaded.task_id || taskId});
      })
      .catch((error) => {
        if (!mounted) return;
        reportOpenError(error);
        onDone();
      });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, taskId]);

  if (!lookupsReady) return null;

  const lookups = {groupUsers, groupUsersLoading: false, sprints};

  if (request.mode === 'create') {
    return (
      <TaskFormModal
        open
        groupId={groupId}
        {...lookups}
        onCreated={(created) => {
          createdRef.current = [{type: 'task', id: created.id, label: `${created.issue_key} · ${created.summary}`}];
        }}
        onSuccess={() => undefined}
        onClose={() => onDone(createdRef.current)}
      />
    );
  }

  if (!task) return null;

  if (request.mode === 'modify') {
    return <TaskFormModal open groupId={groupId} initialData={task} {...lookups} onSuccess={() => undefined} onClose={() => onDone()} />;
  }

  return (
    <TaskDetailModal
      open
      task={task}
      groupId={groupId}
      permissions={{
        task: {
          read: hasPermission('group.task.read'),
          create: hasPermission('group.task.create'),
          modify: hasPermission('group.task.modify'),
          delete: hasPermission('group.task.delete')
        },
        comment: {
          read: hasPermission('group.task.comment.read'),
          create: hasPermission('group.task.comment.create'),
          modify: hasPermission('group.task.comment.modify'),
          delete: hasPermission('group.task.comment.delete')
        }
      }}
      onUpdateTask={setTask}
      {...lookups}
      onClose={() => onDone()}
    />
  );
}
