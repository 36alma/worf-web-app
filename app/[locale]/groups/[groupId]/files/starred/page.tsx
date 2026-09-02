'use client';

import { useGroupPermission } from '@/components/providers/GroupPermissionContext';
import GroupStarredView from '@/components/files/GroupStarredView';

export default function GroupFilesStarredPage() {
  const { groupId, isLoading } = useGroupPermission();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
        <div className="h-24 w-full animate-pulse rounded-xl bg-[var(--bg-elevated)]" />
        <div className="h-24 w-full animate-pulse rounded-xl bg-[var(--bg-elevated)]" />
      </div>
    );
  }

  return <GroupStarredView groupId={groupId} />;
}
