'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import {getDashboardActivity} from '@/lib/api/dashboard';
import type {ActivityItem} from '@/lib/types/dashboard';
import {activityTypes, type ActivityFilter} from '@/lib/utils/dashboardActivity';

export interface UseActivityFeedOptions {
  enabled?: boolean;
  filter: ActivityFilter;
  /** Only this group (its id as the group list or another row gave it); `null` for all. */
  groupId?: string | null;
  pageSize?: number;
  /** Refetch (from the first page) whenever this changes. */
  refreshKey?: number;
}

export interface UseActivityFeedResult {
  /** Rows of the current filter; `null` until that filter has answered once (then the widget shows a skeleton). */
  items: ActivityItem[] | null;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  failed: boolean;
  /** The last request was refused for going over the rate limit (429). */
  rateLimited: boolean;
  /** Fetches the next page with the cursor the last answer gave, and appends it. */
  loadMore: () => Promise<void>;
  retry: () => void;
}

interface Loaded {
  key: string;
  items: ActivityItem[];
  /** Opaque cursor for the next page; `null` when the feed is exhausted. */
  next: string | null;
}

/**
 * The cross-group activity feed (`POST /v1/dashboard/activity`), newest first, paged by cursor.
 * Changing the filter or the group starts over — the old cursor belongs to the old filter and is dropped.
 */
export function useActivityFeed({
  enabled = true,
  filter,
  groupId = null,
  pageSize = 10,
  refreshKey = 0
}: UseActivityFeedOptions): UseActivityFeedResult {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  /** Bumped by every restart, so an answer to a superseded request is recognised and dropped. */
  const generation = useRef(0);

  const requestKey = `${filter}|${groupId ?? ''}`;
  const filters = {types: activityTypes(filter), group_id: groupId};

  useEffect(() => {
    if (!enabled) return;
    const mine = ++generation.current;
    setLoading(true);
    setLoadingMore(false);
    getDashboardActivity({load_number: pageSize, ...filters})
      .then(({data}) => {
        if (mine !== generation.current) return;
        setLoaded({key: requestKey, items: Array.isArray(data.items) ? data.items : [], next: data.next_before ?? null});
        setFailed(false);
        setRateLimited(false);
      })
      .catch((error) => {
        if (mine !== generation.current) return;
        setFailed(true);
        setRateLimited(error?.response?.status === 429);
      })
      .finally(() => {
        if (mine === generation.current) setLoading(false);
      });
    return () => {
      generation.current += 1;
    };
    // `filters` is derived from requestKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, requestKey, pageSize, refreshKey, retryKey]);

  const current = loaded && loaded.key === requestKey ? loaded : null;

  const loadMore = useCallback(async () => {
    if (!current?.next || loadingMore) return;
    const mine = generation.current;
    const {key, next} = current;
    setLoadingMore(true);
    try {
      const {data} = await getDashboardActivity({before: next, load_number: pageSize, ...filters});
      if (mine !== generation.current) return;
      const more = Array.isArray(data.items) ? data.items : [];
      setLoaded((prev) => (prev && prev.key === key ? {...prev, items: [...prev.items, ...more], next: data.next_before ?? null} : prev));
      setRateLimited(false);
    } catch (error) {
      if (mine !== generation.current) return;
      setRateLimited((error as {response?: {status?: number}})?.response?.status === 429);
      throw error;
    } finally {
      if (mine === generation.current) setLoadingMore(false);
    }
    // `filters` is derived from requestKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, loadingMore, pageSize, requestKey]);

  const retry = useCallback(() => setRetryKey((k) => k + 1), []);

  return {
    items: current?.items ?? null,
    hasMore: !!current?.next,
    loading,
    loadingMore,
    failed,
    rateLimited,
    loadMore,
    retry
  };
}
