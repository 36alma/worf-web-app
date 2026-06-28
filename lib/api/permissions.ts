import apiClient from './client';
import {normalizeGroupId} from '@/lib/utils/groupId';

export type PermissionMap = Record<string, boolean>;

const parseJsonIfString = (payload: unknown): unknown => {
  if (typeof payload !== 'string') {
    return payload;
  }

  try {
    return JSON.parse(payload);
  } catch {
    return payload;
  }
};

const toBooleanPermissionValue = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
    if (normalized === '1') return true;
    if (normalized === '0') return false;
  }

  return null;
};

const mapObjectToPermissions = (input: Record<string, unknown>): PermissionMap | null => {
  const entries = Object.entries(input);
  if (entries.length === 0) {
    return {};
  }

  const mappedEntries = entries
    .map(([key, value]) => {
      const normalized = toBooleanPermissionValue(value);
      return normalized === null ? null : ([key, normalized] as const);
    })
    .filter((entry): entry is readonly [string, boolean] => entry !== null);

  if (mappedEntries.length === 0) {
    return null;
  }

  const hasPermissionLikeKey = mappedEntries.some(([key]) => key.includes('.'));
  const everyEntryMapped = mappedEntries.length === entries.length;

  if (!hasPermissionLikeKey && !everyEntryMapped) {
    return null;
  }

  return mappedEntries.reduce<PermissionMap>((acc, [key, value]) => {
    acc[key] = value;
    return acc;
  }, {});
};

const findPermissionMap = (payload: unknown): PermissionMap => {
  const queue: unknown[] = [parseJsonIfString(payload)];
  const visited = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== 'object' || visited.has(current)) {
      continue;
    }
    visited.add(current);

    if (!Array.isArray(current)) {
      const record = current as Record<string, unknown>;
      const direct = mapObjectToPermissions(record);
      if (direct) {
        return direct;
      }
      Object.values(record).forEach((value) => queue.push(parseJsonIfString(value)));
      continue;
    }

    current.forEach((value) => queue.push(parseJsonIfString(value)));
  }

  return {};
};

const normalizePermissionMap = (payload: unknown): PermissionMap => {
  return findPermissionMap(payload);
};

export const getUserPermissions = async (): Promise<PermissionMap> => {
  const {data} = await apiClient.get('/v1/user/permission');
  return normalizePermissionMap(data);
};

export const getGroupPermissions = async (group_id: string): Promise<PermissionMap> => {
  const safeGroupId = normalizeGroupId(group_id);

  try {
    const response = await apiClient.post('/v1/group/permission', {group_id: safeGroupId});

    console.log('[getGroupPermissions] raw response.data:', JSON.stringify(response.data));
    const result = normalizePermissionMap(response.data);
    console.log('[getGroupPermissions] normalized result:', result);
    return result;
  } catch (error) {
    console.error('[getGroupPermissions] error:', error);
    throw error;
  }
};
