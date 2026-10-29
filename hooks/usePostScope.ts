'use client';

import {useCallback, useEffect, useMemo} from 'react';
import {getGroupPermissions} from '@/lib/api/permissions';
import {usePermissionStore} from '@/lib/store/permissionStore';
import {useAuthStore} from '@/lib/store/authStore';
import {hasPostPermission, type PostModel, type PostPermissionKey} from '@/lib/posts/model';

/**
 * Permission context of one post scope: the global feed (`groupId` empty) or a group.
 * Group permissions are loaded into the shared store on first use.
 */
export function usePostScope(groupId: string) {
  const isGroup = Boolean(groupId);
  const {user} = useAuthStore();
  const {
    systemPermissions,
    isSystemPermissionsLoaded,
    groupPermissionsById,
    groupPermissionsStatusById,
    setGroupPermissions,
    setGroupPermissionsLoading,
    setGroupPermissionsError
  } = usePermissionStore();

  const status = isGroup ? groupPermissionsStatusById[groupId] : undefined;

  useEffect(() => {
    if (!isGroup || status === 'loading' || status === 'loaded' || status === 'error') return;
    setGroupPermissionsLoading(groupId, true);
    getGroupPermissions(groupId)
      .then((permissions) => setGroupPermissions(groupId, permissions))
      .catch(() => setGroupPermissionsError(groupId));
  }, [groupId, isGroup, setGroupPermissions, setGroupPermissionsError, setGroupPermissionsLoading, status]);

  const permissions = useMemo(
    () => (isGroup ? groupPermissionsById[groupId] ?? {} : systemPermissions),
    [groupId, groupPermissionsById, isGroup, systemPermissions]
  );
  const loaded = isGroup ? status === 'loaded' || status === 'error' : isSystemPermissionsLoaded;
  const currentUserId = user?.id || (user as {user_id?: string} | null)?.user_id;

  const can = useCallback((key: PostPermissionKey) => hasPostPermission(permissions, key, isGroup), [isGroup, permissions]);

  /** Author of the post (only the author's `get` carries `review`) or a `*.modify.other` holder. */
  const isAuthor = useCallback(
    (post: Pick<PostModel, 'authorId' | 'isAuthorView'>) =>
      post.isAuthorView || (Boolean(currentUserId) && currentUserId === post.authorId),
    [currentUserId]
  );
  const canSeeAuthorTools = useCallback(
    (post: Pick<PostModel, 'authorId' | 'isAuthorView'>) => isAuthor(post) || can('modifyOther'),
    [can, isAuthor]
  );

  return {isGroup, groupId: groupId || undefined, permissions, loaded, currentUserId, can, isAuthor, canSeeAuthorTools};
}
