import {normalizeGroupId} from './groupId';

export interface UserGroupSummary {
  id: string;
  name: string;
}

const ARRAY_KEYS = ['group_users', 'groups', 'items', 'rows', 'result'];

/**
 * Normalizes what `getUserGroups()` answers (`response.data`, in whichever envelope the endpoint uses) into
 * `{id, name}[]`. The id is the opaque group id in its raw form — the one `group_id` fields elsewhere carry.
 */
export function parseUserGroups(payload: unknown): UserGroupSummary[] {
  const source =
    payload && typeof payload === 'object' && 'data' in (payload as Record<string, unknown>)
      ? (payload as Record<string, unknown>).data
      : payload;

  let list: unknown[] = [];
  if (Array.isArray(source)) {
    list = source;
  } else if (source && typeof source === 'object') {
    const record = source as Record<string, unknown>;
    const key = ARRAY_KEYS.find((k) => Array.isArray(record[k]));
    list = (key ? (record[key] as unknown[]) : Object.values(record).find(Array.isArray)) as unknown[] | undefined ?? [];
  }

  return list.flatMap((item): UserGroupSummary[] => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    const id = normalizeGroupId(String(row.group_id ?? row.id ?? ''));
    return id ? [{id, name: String(row.group_name ?? row.name ?? id)}] : [];
  });
}
