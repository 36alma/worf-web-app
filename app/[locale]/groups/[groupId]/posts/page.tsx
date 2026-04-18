'use client';

import { useGroupPermission } from '@/components/providers/GroupPermissionContext';
import PostsFeed from '@/components/posts/PostsFeed';

/**
 * Group Posts page — uses GroupPermissionContext for the clean, decoded groupId.
 * The parent layout (groups/[groupId]/layout.tsx) already handles:
 *   1. decodeURIComponent on the raw [groupId] param
 *   2. Wrapping children in GroupPermissionProvider
 *
 * Silent Policy: shows a loading skeleton while permissions load.
 * If group.post.read is false, PostsFeed handles the empty render.
 */
export default function GroupPostsPage() {
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

  return <PostsFeed mode="group" groupId={groupId} />;
}
