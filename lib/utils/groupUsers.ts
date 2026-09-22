import type {GroupUser} from '@/components/groups/tasks/types';

/** Normalizes the group-members payload (response or `response.data`) into `GroupUser[]`. */
export const parseGroupUsers = (payload: unknown): GroupUser[] => {
  if (!payload || typeof payload !== 'object') return [];
  const raw = payload as Record<string, unknown>;
  const data = raw.data ?? raw;
  const inner = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
  const arr = inner.data ?? inner.users ?? inner.group_users ?? inner.items ?? (Array.isArray(data) ? data : []);
  if (!Array.isArray(arr)) return [];

  return arr
    .map((item: any): GroupUser | null => {
      if (!item || typeof item !== 'object') return null;
      const user_id = String(item.user_id ?? '').trim();
      if (!user_id) return null;
      return {
        user_id,
        full_name: String(item.full_name ?? item.fullname ?? item.name ?? item.email ?? ''),
        email: String(item.email ?? ''),
        username: String(item.username ?? (item.email ?? '').split('@')[0] ?? '')
      };
    })
    .filter((user): user is GroupUser => user !== null);
};
