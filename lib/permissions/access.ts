export interface PermissionRequirement {
  anyOf?: string[];
  allOf?: string[];
}

export type PermissionEvaluationMode = 'strict' | 'explicit';

export type NavKey =
  | 'dashboard'
  | 'groups'
  | 'tasks'
  | 'calendar'
  | 'posts'
  | 'roles'
  | 'permissions'
  | 'admin'
  | 'profile';

export const navPermissionRequirements: Record<NavKey, PermissionRequirement | null | 'GROUP_ONLY'> = {
  dashboard: null,
  groups: {anyOf: ['group.get.user', 'group.get.all.group']},
  tasks: 'GROUP_ONLY',
  calendar: 'GROUP_ONLY',
  posts: {anyOf: ['post.get.global']},
  roles: 'GROUP_ONLY',
  permissions: 'GROUP_ONLY',
  admin: {anyOf: ['role.get.all.role', 'group.get.all.group', 'user.get.prealluser']},
  profile: null
};

export const groupNavPermissionRequirements: Partial<Record<NavKey, PermissionRequirement>> = {
  tasks: {anyOf: ['group.task.read']},
  calendar: {anyOf: ['group.calendar.read', 'group.calendar.write']},
  posts: {anyOf: ['group.post.read']},
  roles: {anyOf: ['group.role.get']},
  permissions: {anyOf: ['group.permission.get.all']}
};

export const systemRoutePermissionRequirements: Record<string, PermissionRequirement | null | 'GROUP_ONLY'> = {
  dashboard: null,
  groups: {anyOf: ['group.get.user', 'group.get.all.group']},
  tasks: 'GROUP_ONLY',
  calendar: 'GROUP_ONLY',
  posts: {anyOf: ['post.get.global']},
  admin: {anyOf: ['role.get.all.role', 'group.get.all.group', 'user.get.prealluser']},
  profile: null
};

export const groupRoutePermissionRequirements: Record<string, PermissionRequirement | null> = {
  '': null,
  tasks: {anyOf: ['group.task.read']},
  calendar: {anyOf: ['group.calendar.read', 'group.calendar.write']},
  posts: {anyOf: ['group.post.read']},
  roles: {anyOf: ['group.role.get']},
  permissions: {anyOf: ['group.permission.get.all']},
  members: null
};

export const hasPermissionRequirement = (
  permissionMap: Record<string, boolean>,
  requirement: PermissionRequirement | null,
  options?: {mode?: PermissionEvaluationMode}
) => {
  const mode = options?.mode ?? 'strict';
  if (!requirement) {
    return true;
  }

  if (
    requirement.allOf &&
    requirement.allOf.some((permission) =>
      mode === 'explicit' ? permissionMap[permission] === false : !permissionMap[permission]
    )
  ) {
    return false;
  }

  if (requirement.anyOf) {
    const hasAllowedPermission = requirement.anyOf.some((permission) => permissionMap[permission] === true);
    if (hasAllowedPermission) {
      return true;
    }

    if (
      mode === 'strict'
        ? requirement.anyOf.every((permission) => !permissionMap[permission])
        : requirement.anyOf.every((permission) => permissionMap[permission] === false)
    ) {
      return false;
    }
  }

  return true;
};
