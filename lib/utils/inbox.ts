import type {InboxItem} from '@/lib/types/notifications';

/**
 * A React `key` that survives a refetch. `notification_id` is re-encrypted on every response, so the position in
 * the (newest-first, stable-order) page plus `created_at` is what actually identifies a row across renders.
 */
export const inboxItemKey = (item: Pick<InboxItem, 'created_at'>, index: number): string =>
  `${index}|${item.created_at}`;
