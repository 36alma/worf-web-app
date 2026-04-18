'use client';

import { useMemo } from 'react';
import PostsFeed from '@/components/posts/PostsFeed';
import { useUiStore } from '@/lib/store/uiStore';

export default function PostsPage() {
  const { selectedGroupId } = useUiStore();

  // If a group is selected in the UI, show group posts
  // Otherwise fall back to global posts
  const mode = useMemo(
    () => (selectedGroupId ? 'group' : 'global'),
    [selectedGroupId]
  );

  const groupId = selectedGroupId || '';

  return <PostsFeed mode={mode} groupId={groupId} />;
}
