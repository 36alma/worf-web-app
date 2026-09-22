'use client';

import {useEffect, useState} from 'react';
import {getDashboardSummary} from '@/lib/api/dashboard';
import type {DashboardSummary} from '@/lib/types/dashboard';

export interface UseDashboardSummaryOptions {
  /** Skip the request (e.g. while nobody is signed in). */
  enabled?: boolean;
  /** Refetch whenever this changes. */
  refreshKey?: number;
}

export interface UseDashboardSummaryResult {
  /** The last good answer — kept while a refetch is running or after it failed, so the cards do not flash. */
  summary: DashboardSummary | null;
  loading: boolean;
  failed: boolean;
}

const isSummary = (value: unknown): value is DashboardSummary =>
  !!value && typeof value === 'object' && typeof (value as DashboardSummary).group_count === 'number';

/** The numbers behind the KPI cards and the "no group yet" decision (`POST /v1/dashboard/summary`). */
export function useDashboardSummary({enabled = true, refreshKey = 0}: UseDashboardSummaryOptions = {}): UseDashboardSummaryResult {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let mounted = true;
    setLoading(true);
    getDashboardSummary()
      .then(({data}) => {
        if (!mounted) return;
        if (isSummary(data)) {
          setSummary(data);
          setFailed(false);
        } else {
          setFailed(true);
        }
      })
      .catch(() => mounted && setFailed(true))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [enabled, refreshKey]);

  return {summary, loading, failed};
}
