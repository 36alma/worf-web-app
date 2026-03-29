export interface PermissionRequirement {
  anyOf?: string[];
  allOf?: string[];
}

export type NavKey = 'dashboard' | 'groups' | 'tasks' | 'calendar' | 'posts' | 'admin' | 'profile';

export const navPermissionRequirements: Record<NavKey, PermissionRequirement | null> = {
  dashboard: null,
  groups: {anyOf: ['group.get.user', 'group.get.all.group']},
  tasks: null,
  calendar: null,
  posts: {anyOf: ['post.get.global']},
  admin: {anyOf: ['role.get.all.role', 'group.get.all.group', 'user.get.prealluser']},
  profile: null
};

export const systemRoutePermissionRequirements: Record<string, PermissionRequirement | null> = {
  dashboard: null,
  groups: {anyOf: ['group.get.user', 'group.get.all.group']},
  tasks: null,
  calendar: null,
  posts: {anyOf: ['post.get.global']},
  admin: {anyOf: ['role.get.all.role', 'group.get.all.group', 'user.get.prealluser']},
  profile: null
};

export const groupRoutePermissionRequirements: Record<string, PermissionRequirement | null> = {
  '': null,
  calendar: {anyOf: ['group.calendar.read', 'group.calendar.write']},
  posts: {anyOf: ['group.post.read']},
  roles: {anyOf: ['group.role.get', 'group.permission.get.all']},
  members: null
};

export const hasPermissionRequirement = (
  permissionMap: Record<string, boolean>,
  requirement: PermissionRequirement | null
) => {
  if (!requirement) {
    return true;
  }

  if (requirement.allOf && requirement.allOf.some((permission) => !permissionMap[permission])) {
    return false;
  }

  if (requirement.anyOf && !requirement.anyOf.some((permission) => permissionMap[permission])) {
    return false;
  }

  return true;
};
