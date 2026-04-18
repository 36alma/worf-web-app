'use client';

import {use} from 'react';
import {useGroupPermission} from '@/components/providers/GroupPermissionContext';
import TaskClientWrapper from '@/components/groups/tasks/TaskClientWrapper';

export default function GroupTasksPage({params}: {params: Promise<{groupId: string, locale: string}>}) {
  const {isLoading, hasPermission} = useGroupPermission();
  const unwrappedParams = use(params);

  // KÖTELEZŐ: URL dekódolás az esetleges %3D miatt
  const decodedGroupId = decodeURIComponent(unwrappedParams.groupId);

  // ── Skeleton while loading permissions ─────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
        <div className="flex gap-4">
          <div className="h-[75vh] w-[320px] animate-pulse rounded-xl bg-[var(--bg-elevated)]" />
          <div className="h-[75vh] w-[320px] animate-pulse rounded-xl bg-[var(--bg-elevated)]" />
          <div className="h-[75vh] w-[320px] animate-pulse rounded-xl bg-[var(--bg-elevated)]" />
        </div>
      </div>
    );
  }

  // ── Silent Policy: no read permission → blank screen ───────────────
  if (!hasPermission('group.task.read')) {
    return null;
  }

  const permissions = {
    task: {
      read: hasPermission('group.task.read'),
      create: hasPermission('group.task.create'),
      modify: hasPermission('group.task.modify'),
      delete: hasPermission('group.task.delete')
    },
    category: {
      read: hasPermission('group.task.category.read'),
      create: hasPermission('group.task.category.create'),
      modify: hasPermission('group.task.category.modify'),
      delete: hasPermission('group.task.category.delete')
    },
    comment: {
      read: hasPermission('group.task.comment.read'),
      create: hasPermission('group.task.comment.create'),
      modify: hasPermission('group.task.comment.modify'),
      delete: hasPermission('group.task.comment.delete')
    }
  };

  return (
    <section className="h-[calc(100vh-120px)] w-full">
      <TaskClientWrapper groupId={decodedGroupId} permissions={permissions} />
    </section>
  );
}
