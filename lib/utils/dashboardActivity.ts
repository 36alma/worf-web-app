import type {ActivityItem} from '@/lib/types/dashboard';

/** The entity filter of the feed: everything, or one entity's events (`task`, `minutes` — the API's entity tokens). */
export type ActivityFilter = 'all' | 'task' | 'minutes';

export const ACTIVITY_FILTERS: ActivityFilter[] = ['all', 'task', 'minutes'];

/** The `types` request field for a filter; `null` asks for everything. */
export const activityTypes = (filter: ActivityFilter): string[] | null => (filter === 'all' ? null : [filter]);

/**
 * A key for a feed row. `entity.id` is encrypted afresh per response and cannot serve, so the timestamp plus the
 * position does — the list is only ever replaced or appended to, never reordered.
 */
export const activityKey = (item: Pick<ActivityItem, 'occurred_at'>, index: number): string => `${item.occurred_at}#${index}`;
