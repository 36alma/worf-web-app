'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import {archiveInboxItems, actionInboxItem, deleteInboxItems, listInbox, markInboxRead} from '@/lib/api/notifications';
import type {
  InboxActionKind,
  InboxActionResponse,
  InboxFilter,
  InboxItem,
  NotificationCategory
} from '@/lib/types/notifications';

export interface UseInboxListOptions {
  enabled?: boolean;
  filter: InboxFilter;
  category?: NotificationCategory | null;
  pageSize?: number;
  /** Refetch (from the first page) whenever this changes. */
  refreshKey?: number;
}

export interface UseInboxListResult {
  /** `null` until the current filter has answered once. */
  items: InboxItem[] | null;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  failed: boolean;
  loadMore: () => Promise<void>;
  retry: () => void;
  markRead: (ids: string[], read: boolean) => Promise<void>;
  toggleArchive: (ids: string[], archived: boolean) => Promise<void>;
  remove: (ids: string[]) => Promise<void>;
  /** Resolves to the server's response so the caller can navigate (`OPEN`) or toast on a hard failure. */
  performAction: (notificationId: string, action: InboxActionKind) => Promise<InboxActionResponse | null>;
}

interface Loaded {
  key: string;
  items: InboxItem[];
  next: string | null;
}

const statusOf = (error: unknown) =>
  (error as {response?: {status?: number}} | undefined)?.response?.status ?? 0;

/**
 * The Inbox list (`POST /v1/notification/inbox/list`), newest first, paged by opaque cursor. Changing the filter or
 * category starts over. `markRead`/`toggleArchive`/`remove` refetch the first page afterwards (like
 * `usePendingWitnessMinutes`) — simpler and safer than hand-rolled optimistic branching for a filter-dependent list.
 * `performAction` is the one exception: the server's answer is immediate and exact, so it patches the item in place.
 */
export function useInboxList({
  enabled = true,
  filter,
  category = null,
  pageSize = 20,
  refreshKey = 0
}: UseInboxListOptions): UseInboxListResult {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const generation = useRef(0);

  const requestKey = `${filter}|${category ?? ''}`;

  useEffect(() => {
    if (!enabled) return;
    const mine = ++generation.current;
    setLoading(true);
    setLoadingMore(false);
    listInbox({filter, category, load_number: pageSize})
      .then(({data}) => {
        if (mine !== generation.current) return;
        setLoaded({key: requestKey, items: Array.isArray(data.items) ? data.items : [], next: data.next_before ?? null});
        setFailed(false);
      })
      .catch(() => {
        if (mine !== generation.current) return;
        setFailed(true);
      })
      .finally(() => {
        if (mine === generation.current) setLoading(false);
      });
    return () => {
      generation.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, requestKey, pageSize, refreshKey, retryKey]);

  const current = loaded && loaded.key === requestKey ? loaded : null;

  const loadMore = useCallback(async () => {
    if (!current?.next || loadingMore) return;
    const mine = generation.current;
    const {key, next} = current;
    setLoadingMore(true);
    try {
      const {data} = await listInbox({filter, category, before: next, load_number: pageSize});
      if (mine !== generation.current) return;
      const more = Array.isArray(data.items) ? data.items : [];
      setLoaded((prev) => (prev && prev.key === key ? {...prev, items: [...prev.items, ...more], next: data.next_before ?? null} : prev));
    } finally {
      if (mine === generation.current) setLoadingMore(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, loadingMore, pageSize, requestKey]);

  const retry = useCallback(() => setRetryKey((k) => k + 1), []);

  const markRead = useCallback(async (ids: string[], read: boolean) => {
    if (ids.length === 0) return;
    await markInboxRead({notification_ids: ids, read});
    retry();
  }, [retry]);

  const toggleArchive = useCallback(async (ids: string[], archived: boolean) => {
    if (ids.length === 0) return;
    await archiveInboxItems({notification_ids: ids, archived});
    retry();
  }, [retry]);

  const remove = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    await deleteInboxItems({notification_ids: ids});
    retry();
  }, [retry]);

  const patchItem = useCallback((notificationId: string, patch: Partial<InboxItem>) => {
    setLoaded((prev) =>
      prev
        ? {...prev, items: prev.items.map((item) => (item.notification_id === notificationId ? {...item, ...patch} : item))}
        : prev
    );
  }, []);

  const performAction = useCallback(
    async (notificationId: string, action: InboxActionKind): Promise<InboxActionResponse | null> => {
      try {
        const {data} = await actionInboxItem({notification_id: notificationId, action});
        if (action !== 'OPEN') {
          patchItem(notificationId, {
            read: true,
            action: {kind: 'EVENT_INVITATION', status: 'COMPLETED', available: [], result: data.result}
          });
        } else {
          patchItem(notificationId, {read: true});
        }
        return data;
      } catch (error) {
        const status = statusOf(error);
        if (status === 404) {
          setLoaded((prev) => (prev ? {...prev, items: prev.items.filter((item) => item.notification_id !== notificationId)} : prev));
        } else if (status === 403) {
          patchItem(notificationId, {action: {kind: 'EVENT_INVITATION', status: 'FORBIDDEN', available: [], result: null}});
        } else if (status === 409) {
          const payload = (error as {response?: {data?: Partial<InboxActionResponse>}}).response?.data;
          patchItem(notificationId, {
            action: {
              kind: 'EVENT_INVITATION',
              status: payload?.status === 'COMPLETED' ? 'COMPLETED' : 'EXPIRED',
              available: [],
              result: payload?.result ?? null
            }
          });
        }
        throw error;
      }
    },
    [patchItem]
  );

  return {
    items: current?.items ?? null,
    hasMore: !!current?.next,
    loading,
    loadingMore,
    failed,
    loadMore,
    retry,
    markRead,
    toggleArchive,
    remove,
    performAction
  };
}
