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
  const hasBasePermission = permissions[basePermission] === true;
  const hasOtherPermission = permissions[otherPermission] === true;

  // If user has .other permission, they can act on any post (including others')
  // This covers admins/moderators who can edit/delete anyone's posts
  if (hasBasePermission && hasOtherPermission) {
    return true;
  }

  // If user only has base permission (no .other), they can only act on their own posts
  // We need a valid currentUserId to compare with the author
  if (hasBasePermission && currentUserId) {
    const isOwnPost = currentUserId === postAuthorId;
    return isOwnPost;
  }

  return false;
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
