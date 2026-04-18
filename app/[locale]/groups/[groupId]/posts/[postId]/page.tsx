'use client';

import { useParams } from 'next/navigation';
import { useMemo } from 'react';
import { useGroupPermission } from '@/components/providers/GroupPermissionContext';
import PostReadScreen from '@/components/posts/PostReadScreen';

/**
 * Read Group Post page — uses GroupPermissionContext for the clean groupId.
 * The postId is extracted from URL params and decoded via decodeURIComponent.
 * Silent Policy: shows skeleton while permissions load.
 */
export default function ReadGroupPostPage() {
  const { groupId, isLoading } = useGroupPermission();
  const params = useParams<{ postId: string }>();

  const postId = useMemo(() => {
    const raw = params?.postId ?? '';
    try {
      return decodeURIComponent(raw.trim());
    } catch {
      return raw.trim();
    }
  }, [params?.postId]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
        <div className="h-64 w-full animate-pulse rounded-xl bg-[var(--bg-elevated)]" />
      </div>
    );
  }

  return <PostReadScreen scope="group" groupId={groupId} postId={postId} />;
}
