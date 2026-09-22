'use client';

import {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {useDashboardSummary} from '@/hooks/useDashboardSummary';
import {useAuthStore} from '@/lib/store/authStore';
import type {DashboardSummary} from '@/lib/types/dashboard';
import {createCoalescer, type Coalescer} from '@/lib/utils/refreshCoalescer';

export type DashboardKey = 'summary' | 'tasks' | 'events' | 'activity';

/**
 * `summary` and `upcoming/all` are limited to 60 requests / 2 minutes per client IP, and everyone behind one NAT shares
 * that bucket — so saves never refetch straight away, they queue a refresh that is merged with its neighbours.
 */
const REFRESH_DELAY_MS = 1000;

const INITIAL_KEYS: Record<DashboardKey, number> = {summary: 0, tasks: 0, events: 0, activity: 0};

interface DashboardContextValue {
  /** Last good `dashboard/summary` answer; one request shared by the KPI and welcome cards. */
  summary: DashboardSummary | null;
  summaryLoading: boolean;
  summaryFailed: boolean;
  /** Bumps whenever that widget's data should be refetched — pass it as the hook's `refreshKey`. */
  refreshKeys: Record<DashboardKey, number>;
  /** Queue a refetch of the given widgets (merged with any others queued in the same window). */
  refresh: (...keys: DashboardKey[]) => void;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({children}: {children: ReactNode}) {
  const user = useAuthStore((s) => s.user);
  const [refreshKeys, setRefreshKeys] = useState(INITIAL_KEYS);
  const coalescer = useRef<Coalescer<DashboardKey> | null>(null);

  useEffect(() => {
    const instance = createCoalescer<DashboardKey>((batch) => {
      setRefreshKeys((prev) => {
        const next = {...prev};
        batch.forEach((key) => {
          next[key] += 1;
        });
        return next;
      });
    }, REFRESH_DELAY_MS);
    coalescer.current = instance;
    return () => {
      instance.cancel();
      coalescer.current = null;
    };
  }, []);

  const refresh = useCallback((...keys: DashboardKey[]) => coalescer.current?.request(...keys), []);

  const {summary, loading, failed} = useDashboardSummary({enabled: !!user, refreshKey: refreshKeys.summary});

  const value = useMemo<DashboardContextValue>(
    () => ({summary, summaryLoading: loading || !user, summaryFailed: failed, refreshKeys, refresh}),
    [summary, loading, failed, user, refreshKeys, refresh]
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used inside <DashboardProvider>');
  return ctx;
}
