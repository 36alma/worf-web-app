'use client';

import {useCallback, useEffect, useState} from 'react';
import {listAllTasks} from '@/lib/api/dashboard';
import type {DashboardTask} from '@/lib/types/dashboard';
import {dashboardTaskKey, normalizeDashboardTask} from '@/lib/utils/dashboardTasks';

/** `open`: assigned to me and not DONE (the KPI number). `overdue`: the past-due subset of it. */
export type MyTasksFilter = 'open' | 'overdue';

export interface UseMyTasksOptions {
  enabled?: boolean;
  filter: MyTasksFilter;
  /** How many rows to bring (server maximum 50); `total` is the full count either way. */
  loadNumber?: number;
  /** Refetch whenever this changes. */
  refreshKey?: number;
}

export interface UseMyTasksResult {
  /** Rows of the current `filter`; `null` until that filter has answered once (then the widget shows a skeleton). */
  tasks: DashboardTask[] | null;
  total: number;
  loading: boolean;
  failed: boolean;
  /** The last request was refused for going over the rate limit (429). */
  rateLimited: boolean;
  /** Merge `patch` into the row with this key — for optimistic edits and edits made in the detail modal. */
  patchTask: (key: string, patch: Partial<DashboardTask>) => void;
  retry: () => void;
}

interface Loaded {
  filter: MyTasksFilter;
  tasks: DashboardTask[];
  total: number;
}

/** "My tasks" across every group (`POST /v1/task/panel/all`, scope `assigned_to_me`). */
export function useMyTasks({enabled = true, filter, loadNumber = 10, refreshKey = 0}: UseMyTasksOptions): UseMyTasksResult {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let mounted = true;
    setLoading(true);
    listAllTasks({
      load_number: loadNumber,
      scope: 'assigned_to_me',
      ...(filter === 'overdue' ? {overdue_only: true} : {exclude_done: true})
    })
      .then(({data}) => {
        if (!mounted) return;
        const tasks = (Array.isArray(data.tasks) ? data.tasks : []).map(normalizeDashboardTask);
        setLoaded({filter, tasks, total: typeof data.total_tasks === 'number' ? data.total_tasks : tasks.length});
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
  }, [enabled, filter, loadNumber, refreshKey, retryKey]);

  const patchTask = useCallback((key: string, patch: Partial<DashboardTask>) => {
    setLoaded((prev) =>
      prev ? {...prev, tasks: prev.tasks.map((task) => (dashboardTaskKey(task) === key ? {...task, ...patch} : task))} : prev
    );
  }, []);

  const retry = useCallback(() => setRetryKey((k) => k + 1), []);

  const current = loaded && loaded.filter === filter ? loaded : null;
  return {
    tasks: current?.tasks ?? null,
    total: current?.total ?? 0,
    loading,
    failed,
    rateLimited,
    patchTask,
    retry
  };
}
