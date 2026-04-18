/**
 * Post-specific permission guards
 * Implements the system prompt rules for post modify/delete actions
 * https://system-prompt.md#4-modifydelete-button-guard-rule
 */

import { hasPermissionRequirement, PermissionRequirement } from './access';

interface PostGuardParams {
  currentUserId: string | undefined;
  postAuthorId: string;
  permissions: Record<string, boolean>;
  basePermission: string;
  otherPermission: string;
}

/**
 * Determines if a user can perform a modification action (edit/delete) on a post.
 *
 * Rules (from system prompt):
 * - If post is owned by current user: require only base permission
 * - If post belongs to another user: require base permission AND .other variant
 * - If .other permission is false: return false (button will be hidden silently)
 *
 * @param params - Guard parameters with user ID, post author, and permissions
 * @returns true if action is allowed, false otherwise (button hidden silently)
 */
export const canModifyOrDeletePost = ({
  currentUserId,
  postAuthorId,
  permissions,
  basePermission,
  otherPermission
}: PostGuardParams): boolean => {
  // If user ID is not available, deny access
  if (!currentUserId) {
    return false;
  }

  // Check if current user owns the post
  const isOwnPost = currentUserId === postAuthorId;

  if (isOwnPost) {
    // Own post: only need base permission
    return permissions[basePermission] === true;
  } else {
    // Other's post: need both base permission AND .other variant
    const hasBasePermission = permissions[basePermission] === true;
    const hasOtherPermission = permissions[otherPermission] === true;

    return hasBasePermission && hasOtherPermission;
  }
};

/**
 * Global post modify guard
 */
export const canModifyGlobalPost = (
  currentUserId: string | undefined,
  postAuthorId: string,
  permissions: Record<string, boolean>
): boolean => {
  return canModifyOrDeletePost({
    currentUserId,
    postAuthorId,
    permissions,
    basePermission: 'post.modify.global',
    otherPermission: 'post.modify.other.global'
  });
};

/**
 * Global post delete guard
 */
export const canDeleteGlobalPost = (
  currentUserId: string | undefined,
  postAuthorId: string,
  permissions: Record<string, boolean>
): boolean => {
  return canModifyOrDeletePost({
    currentUserId,
    postAuthorId,
    permissions,
    basePermission: 'post.delete.global',
    otherPermission: 'post.delete.other.global'
  });
};

/**
 * Group post modify guard
 */
export const canModifyGroupPost = (
  currentUserId: string | undefined,
  postAuthorId: string,
  permissions: Record<string, boolean>
): boolean => {
  return canModifyOrDeletePost({
    currentUserId,
    postAuthorId,
    permissions,
    basePermission: 'group.post.modify',
    otherPermission: 'group.post.modify.other'
  });
};

/**
 * Group post delete guard
 */
export const canDeleteGroupPost = (
  currentUserId: string | undefined,
  postAuthorId: string,
  permissions: Record<string, boolean>
): boolean => {
  return canModifyOrDeletePost({
    currentUserId,
    postAuthorId,
    permissions,
    basePermission: 'group.post.delete',
    otherPermission: 'group.post.delete.other'
  });
};
