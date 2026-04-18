'use client';

import { useGroupPermission } from '@/components/providers/GroupPermissionContext';
import PostEditorScreen from '@/components/posts/PostEditorScreen';

/**
 * New Group Post page — uses GroupPermissionContext for the clean groupId.
 * Silent Policy: shows skeleton while permissions load.
 */
export default function NewGroupPostPage() {
  const { groupId, isLoading } = useGroupPermission();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
        <div className="h-64 w-full animate-pulse rounded-xl bg-[var(--bg-elevated)]" />
      </div>
    );
  }

  return <PostEditorScreen scope="group" groupId={groupId} />;
}
