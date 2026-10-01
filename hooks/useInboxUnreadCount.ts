'use client';

import {useCallback, useEffect, useState} from 'react';
import {countInboxUnread} from '@/lib/api/notifications';

export interface UseInboxUnreadCountOptions {
  enabled?: boolean;
  /** Polling period in ms. */
  intervalMs?: number;
  /** Bump this after an action to refresh immediately, instead of waiting for the next tick. */
  refreshKey?: number;
}

export interface UseInboxUnreadCountResult {
  unread: number;
  loading: boolean;
  failed: boolean;
  refetch: () => void;
}

/** Polls `/v1/notification/inbox/count` for the bell badge. */
export function useInboxUnreadCount({
  enabled = true,
  intervalMs = 60_000,
  refreshKey = 0
}: UseInboxUnreadCountOptions = {}): UseInboxUnreadCountResult {
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((k) => k + 1), []);

  useEffect(() => {
    if (!enabled) return;
    let mounted = true;

    const fetchCount = () => {
      setLoading(true);
      countInboxUnread()
        .then(({data}) => {
          if (!mounted) return;
          setUnread(typeof data?.unread === 'number' ? data.unread : 0);
          setFailed(false);
        })
        .catch(() => {
          if (!mounted) return;
          setFailed(true);
        })
        .finally(() => mounted && setLoading(false));
    };

    fetchCount();
    const id = setInterval(fetchCount, intervalMs);

    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [enabled, intervalMs, refreshKey, tick]);

  return {unread, loading, failed, refetch};
}
