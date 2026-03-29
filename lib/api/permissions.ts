import apiClient from './client';

export type PermissionMap = Record<string, boolean>;

const normalizePermissionMap = (payload: unknown): PermissionMap => {
  const raw = typeof payload === 'object' && payload !== null && 'data' in payload ? payload.data : payload;

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }

  return Object.entries(raw as Record<string, unknown>).reduce<PermissionMap>((acc, [key, value]) => {
    acc[key] = Boolean(value);
    return acc;
  }, {});
};

export const getUserPermissions = async (): Promise<PermissionMap> => {
  const {data} = await apiClient.get('/v1/user/permission');
  return normalizePermissionMap(data);
};

export const getGroupPermissions = async (group_id: string): Promise<PermissionMap> => {
  const {data} = await apiClient.get('/v1/group/permission', {params: {group_id}});
  return normalizePermissionMap(data);
};
