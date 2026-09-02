'use client';

import { useCallback, useEffect, useState } from 'react';

export interface DualListPage<A, B> {
  listA: A[];
  listB: B[];
  totalA: number;
  totalB: number;
}

export interface UsePagedDualListResult<A, B> {
  listA: A[];
  listB: B[];
  totalA: number;
  totalB: number;
  isLoading: boolean;
  hasMore: boolean;
  loadMore: () => void;
  reset: () => void;
}

/**
 * Shared pagination for the four backend endpoints that return two lists
 * (subfolders+files, or folders+files) sharing one offset/limit pair
 * (spec: folders/list §5.1, starred/list §9, shared-with-me/list §10, and
 * the combined trash view in Task 25). `loadMore` appends; `reset` (used
 * after navigating to a different folder, or after a mutation) reloads
 * page 0 and replaces.
 */
export function usePagedDualList<A, B>(
  fetchPage: (offset: number, limit: number) => Promise<DualListPage<A, B>>,
  limit: number,
  deps: unknown[]
): UsePagedDualListResult<A, B> {
  const [listA, setListA] = useState<A[]>([]);
  const [listB, setListB] = useState<B[]>([]);
  const [totalA, setTotalA] = useState(0);
  const [totalB, setTotalB] = useState(0);
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(
    async (nextOffset: number) => {
      setIsLoading(true);
      try {
        const page = await fetchPage(nextOffset, limit);
        setListA((current) => (nextOffset === 0 ? page.listA : [...current, ...page.listA]));
        setListB((current) => (nextOffset === 0 ? page.listB : [...current, ...page.listB]));
        setTotalA(page.totalA);
        setTotalB(page.totalB);
        setOffset(nextOffset);
      } finally {
        setIsLoading(false);
      }
    },
    [fetchPage, limit]
  );

  useEffect(() => {
    void load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadKey]);

  return {
    listA,
    listB,
    totalA,
    totalB,
    isLoading,
    hasMore: offset + limit < totalA || offset + limit < totalB,
    loadMore: () => void load(offset + limit),
    reset: () => setReloadKey((key) => key + 1),
  };
}
