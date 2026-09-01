'use client';

import { useGroupPermission } from '@/components/providers/GroupPermissionContext';
import FilesFeed from '@/components/files/FilesFeed';

/**
 * Group Files page — uses GroupPermissionContext for the clean, decoded groupId.
 * The parent layout (groups/[groupId]/layout.tsx) already handles:
 *   1. decodeURIComponent on the raw [groupId] param
 *   2. Wrapping children in GroupPermissionProvider
 */
export default function GroupFilesPage() {
  const { groupId, isLoading } = useGroupPermission();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
        <div className="h-24 w-full animate-pulse rounded-xl bg-[var(--bg-elevated)]" />
        <div className="h-24 w-full animate-pulse rounded-xl bg-[var(--bg-elevated)]" />
        <div className="h-24 w-full animate-pulse rounded-xl bg-[var(--bg-elevated)]" />
      </div>
    );
  }

  return <FilesFeed mode="group" groupId={groupId} basePath={`/groups/${groupId}/files`} />;
}
