'use client';

import {useCallback, useEffect, useState} from 'react';
import {listUpcomingEvents} from '@/lib/api/dashboard';
import type {UpcomingEvent} from '@/lib/types/dashboard';
import {normalizeUpcomingEvent} from '@/lib/utils/dashboardEvents';

/** The window the KPI counts (`upcoming_events_count`), so the card's number and this list's total agree. */
export const UPCOMING_WINDOW_DAYS = 7;

export interface UseUpcomingEventsOptions {
  enabled?: boolean;
  /** How many rows to bring; `total` is the full count either way. */
  loadNumber?: number;
  /** Refetch whenever this changes. */
  refreshKey?: number;
}

export interface UseUpcomingEventsResult {
  /** `null` until the first answer. Kept while a refetch runs, so the list does not flash. */
  events: UpcomingEvent[] | null;
  total: number;
  loading: boolean;
  failed: boolean;
  /** The last request was refused for going over the rate limit (429). */
  rateLimited: boolean;
  retry: () => void;
}

/**
 * Occurrences starting or running in the next {@link UPCOMING_WINDOW_DAYS} days across every group
 * (`POST /v1/group/calendar/upcoming/all`) — the server expands the recurring series.
 */
export function useUpcomingEvents({enabled = true, loadNumber = 8, refreshKey = 0}: UseUpcomingEventsOptions = {}): UseUpcomingEventsResult {
  const [events, setEvents] = useState<UpcomingEvent[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let mounted = true;
    setLoading(true);
    const from = new Date();
    const to = new Date(from.getTime() + UPCOMING_WINDOW_DAYS * 86_400_000);
    listUpcomingEvents({from: from.toISOString(), to: to.toISOString(), load_number: loadNumber})
      .then(({data}) => {
        if (!mounted) return;
        const list = (Array.isArray(data.events) ? data.events : []).map(normalizeUpcomingEvent);
        setEvents(list);
        setTotal(typeof data.total_events === 'number' ? data.total_events : list.length);
        setFailed(false);
        setRateLimited(false);
      })
      .catch((error) => {
        if (!mounted) return;
        setFailed(true);
        setRateLimited(error?.response?.status === 429);
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [enabled, loadNumber, refreshKey, retryKey]);

  const retry = useCallback(() => setRetryKey((k) => k + 1), []);

  return {events, total, loading, failed, rateLimited, retry};
}
