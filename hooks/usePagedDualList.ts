'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

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

  // Guards against out-of-order responses: if the user navigates
  // folder-to-folder quickly (e.g. double-clicking), two load(0) calls can
  // be in flight at once, and without this guard whichever resolves LAST
  // wins — potentially rendering the wrong folder's contents under the
  // current (different) folder's breadcrumb. Each load() call captures its
  // own id; only the call whose id still matches the ref once its fetch
  // resolves is allowed to apply state.
  const requestIdRef = useRef(0);

  const load = useCallback(
    async (nextOffset: number) => {
      const thisRequestId = ++requestIdRef.current;
      setIsLoading(true);
      try {
        const page = await fetchPage(nextOffset, limit);
        if (thisRequestId !== requestIdRef.current) return; // superseded by a newer load()
        setListA((current) => (nextOffset === 0 ? page.listA : [...current, ...page.listA]));
        setListB((current) => (nextOffset === 0 ? page.listB : [...current, ...page.listB]));
        setTotalA(page.totalA);
        setTotalB(page.totalB);
        setOffset(nextOffset);
      } catch {
        // A failed fetch (e.g. a transient network error during loadMore())
        // must not corrupt already-loaded state: leave listA/listB/totalA/
        // totalB/offset exactly as they were so hasMore stays based on the
        // last known-good page and a retry (loadMore/reset) re-requests the
        // same offset. The caller is responsible for surfacing the error to
        // the user (e.g. a toast) before it reaches here; swallowed here (not
        // re-thrown) so `void load(...)` call sites below never produce an
        // unhandled promise rejection.
      } finally {
        if (thisRequestId === requestIdRef.current) setIsLoading(false);
        // else: a newer load() is still in flight and owns isLoading now —
        // clearing it here would incorrectly hide its own loading indicator.
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
