import apiClient from './client';

export const createGroup = (data: {name: string; description?: string}) =>
  apiClient.post('/v1/group/create', data);

export const getUserGroups = () => apiClient.post('/v1/group/getusergroups', {});

export const getAllGroups = () => apiClient.post('/v1/group/getgroups', {});

export const deleteGroup = (group_id: string) => apiClient.post('/v1/group/delete', {group_id});

export const modifyGroupBase = (data: {group_id: string; name?: string; description?: string}) =>
  apiClient.post('/v1/group/modifygroupbase', data);

export const getAdminGroupMembers = (group_id: string) => apiClient.post('/v1/group/admin/getusers', {group_id});

export const getGroupMembers = (group_id: string) => apiClient.post('/v1/group/getusers', {group_id});

export const addUserToGroup = (group_id: string, user_id: string) =>
  apiClient.post('/v1/group/create/add/usertogroup', {group_id, user_id});

export const removeUserFromGroup = (group_id: string, user_id: string) =>
  apiClient.post('/v1/group/delete/remove/userfromgroup', {group_id, user_id});

// OpenAPI: /v1/group/admin/role/get requires group_id; optional group_role_id is supported by backend.
export const getGroupRoles = (
  input:
    | string
    | {
        group_id: string;
        group_role_id?: string;
      }
) => {
  const data = typeof input === 'string' ? {group_id: input} : input;
  const payload: {group_id: string; group_role_id?: string} = {group_id: data.group_id};

  if (data.group_role_id) {
    payload.group_role_id = data.group_role_id;
  }

  return apiClient.post('/v1/group/admin/role/get', payload);
};

export const createGroupRole = (data: {
  group_id: string;
  name: string;
  description?: string;
}) => {
  const payload: {
    group_id: string;
    group_role_name: string;
    group_role_description?: string;
  } = {
    group_id: data.group_id,
    group_role_name: data.name
  };

  if (data.description) {
    payload.group_role_description = data.description;
  }

  return apiClient.post('/v1/group/admin/role/create', payload);
};

export const modifyGroupRole = (data: {
  group_id: string;
  role_id: string;
  name?: string;
  description?: string;
}) => {
  const payload: {
    group_id: string;
    group_role_id: string;
    group_role_name?: string;
    group_role_description?: string;
  } = {
    group_id: data.group_id,
    group_role_id: data.role_id
  };

  if (data.name) {
    payload.group_role_name = data.name;
  }
  if (data.description) {
    payload.group_role_description = data.description;
  }

  return apiClient.post('/v1/group/admin/role/modify', payload);
};

export const deleteGroupRole = (group_id: string, role_id: string) =>
  apiClient.post('/v1/group/admin/role/delete', {group_id, group_role_id: role_id});

// OpenAPI marks only Bearer as required; keep optional group_id pass-through for compatibility.
export const getAllPermissions = (group_id?: string) =>
  apiClient.post('/v1/group/admin/permission/get/all', group_id ? {group_id} : {});

// OpenAPI field name is group_permission_ids (not permission_ids).
export const setFixedRolePermissions = (data: {
  group_id: string;
  group_role_id: string;
  permission_ids: string[];
}) =>
  apiClient.post('/v1/group/admin/role/permission/set/fixed', {
    group_id: data.group_id,
    group_role_id: data.group_role_id,
    group_permission_ids: data.permission_ids
  });

export const addGroupMemberRole = (data: {
  group_id: string;
  user_id: string;
  group_role_id: string;
}) => apiClient.post('/v1/group/admin/member/role/add', data);

export const modifyGroupMemberRole = (data: {
  group_id: string;
  user_id: string;
  group_role_id: string;
}) => apiClient.post('/v1/group/admin/member/role/modify', data);

export const removeGroupMemberRole = (data: {
  group_id: string;
  user_id: string;
  group_role_id?: string;
}) => apiClient.post('/v1/group/admin/member/role/remove', data);

export const setGroupMemberRole = async (data: {
  group_id: string;
  user_id: string;
  current_group_role_id?: string | null;
  next_group_role_id?: string | null;
}) => {
  const base = {group_id: data.group_id, user_id: data.user_id};
  const currentRoleId = data.current_group_role_id ?? null;
  const nextRoleId = data.next_group_role_id ?? null;

  if (!nextRoleId) {
    if (!currentRoleId) {
      return Promise.resolve();
    }
    return removeGroupMemberRole({...base, group_role_id: currentRoleId});
  }

  if (!currentRoleId) {
    return addGroupMemberRole({...base, group_role_id: nextRoleId});
  }

  return modifyGroupMemberRole({...base, group_role_id: nextRoleId});
};

// Backward-compatible alias for existing call sites.
export const assignRoleToGroupMember = (data: {
  group_id: string;
  user_id: string;
  group_role_id: string;
}) =>
  setGroupMemberRole({
    group_id: data.group_id,
    user_id: data.user_id,
    next_group_role_id: data.group_role_id
  });

// --- NON-ADMIN (GROUP MANAGER) ENDPOINTS ---

export const getGroupRolesNonAdmin = (group_id: string, group_role_id?: string) => {
  const payload: {group_id: string; group_role_id?: string} = {group_id};
  if (group_role_id) payload.group_role_id = group_role_id;
  return apiClient.post('/v1/group/role/get', payload);
};

export const createGroupRoleNonAdmin = (data: {
  group_id: string;
  name: string;
  description?: string;
}) => {
  const payload: {
    group_id: string;
    group_role_name: string;
    group_role_description?: string;
  } = {
    group_id: data.group_id,
    group_role_name: data.name
  };

  if (data.description) payload.group_role_description = data.description;
  return apiClient.post('/v1/group/role/create', payload);
};

export const modifyGroupRoleNonAdmin = (data: {
  group_id: string;
  role_id: string;
  name?: string;
  description?: string;
}) => {
  const payload: {
    group_id: string;
    group_role_id: string;
    group_role_name?: string;
    group_role_description?: string;
  } = {
    group_id: data.group_id,
    group_role_id: data.role_id
  };

  if (data.name) payload.group_role_name = data.name;
  if (data.description) payload.group_role_description = data.description;
  return apiClient.post('/v1/group/role/modify', payload);
};

export const deleteGroupRoleNonAdmin = (group_id: string, role_id: string) =>
  apiClient.post('/v1/group/role/delete', {group_id, group_role_id: role_id});

export const getAllPermissionsNonAdmin = () =>
  apiClient.post('/v1/group/permission/get/all', {});

export const setFixedRolePermissionsNonAdmin = (data: {
  group_id: string;
  group_role_id: string;
  permission_ids: string[];
}) =>
  apiClient.post('/v1/group/role/permission/set/fixed', {
    group_id: data.group_id,
    group_role_id: data.group_role_id,
    group_permission_ids: data.permission_ids
  });
