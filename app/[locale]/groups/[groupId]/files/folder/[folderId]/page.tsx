'use client';

import { useParams } from 'next/navigation';
import { useGroupPermission } from '@/components/providers/GroupPermissionContext';
import FilesFeed from '@/components/files/FilesFeed';

export default function GroupFilesFolderPage() {
  const { groupId, isLoading } = useGroupPermission();
  const params = useParams();
  const folderId = decodeURIComponent(String(params.folderId ?? ''));

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

  return <FilesFeed mode="group" groupId={groupId} folderId={folderId} basePath={`/groups/${groupId}/files`} />;
}
