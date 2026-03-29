import apiClient from './client';

export const createGroup = (data: {name: string; description?: string}) =>
  apiClient.post('/v1/group/create', data);

export const getUserGroups = () => apiClient.post('/v1/group/getusergroups', {});

export const getAllGroups = () => apiClient.post('/v1/group/getgroups', {});

export const deleteGroup = (group_id: string) => apiClient.post('/v1/group/delete', {group_id});

export const modifyGroupBase = (data: {group_id: string; name?: string; description?: string}) =>
  apiClient.post('/v1/group/modifygroupbase', data);

export const getGroupMembers = (group_id: string) => apiClient.post('/v1/group/getusers', {group_id});

export const addUserToGroup = (group_id: string, user_id: string) =>
  apiClient.post('/v1/group/create/add/usertogroup', {group_id, user_id});

export const removeUserFromGroup = (group_id: string, user_id: string) =>
  apiClient.post('/v1/group/delete/remove/userfromgroup', {group_id, user_id});

export const getGroupRoles = (group_id: string) => apiClient.post('/v1/group/role/get', {group_id});

export const createGroupRole = (data: {group_id: string; name: string}) =>
  apiClient.post('/v1/group/role/create', data);

export const modifyGroupRole = (data: {group_id: string; role_id: string; name: string}) =>
  apiClient.post('/v1/group/role/modify', data);

export const deleteGroupRole = (group_id: string, role_id: string) =>
  apiClient.post('/v1/group/role/delete', {group_id, role_id});

export const getAllPermissions = (group_id: string) =>
  apiClient.post('/v1/group/permission/get/all', {group_id});

export const setFixedRolePermissions = (data: {
  group_id: string;
  role_id: string;
  permission_ids: string[];
}) => apiClient.post('/v1/group/role/permission/set/fixed', data);
