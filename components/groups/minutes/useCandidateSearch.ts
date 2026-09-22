'use client';

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

/** The server caps `limit` at 50 — above that a candidate list is narrowed with `query` instead. */
export const CANDIDATE_LIMIT = 50;

export interface CandidateSearchResult<T> {
  candidates: T[];
  loading: boolean;
  /** At least one request has settled (successfully or not) — before that an empty list means "not asked yet". */
  loaded: boolean;
  /** The request failed (missing permission, rate limit…) — the caller shows its own hint. */
  failed: boolean;
  /** The answer hit the limit, so it is not the full set — never conclude "X is not a candidate" from it. */
  truncated: boolean;
  reload: () => void;
}

/**
 * A candidate endpoint (`witness/candidates`, `minute-taker/candidates`) with a debounced search query.
 * `scopeKey` identifies what is being asked (group + record): a change refetches, while a new `fetcher`
 * closure alone does not. Skipped entirely while `enabled` is false.
 */
export function useCandidateSearch<T>(
  scopeKey: string,
  fetcher: (query: string) => Promise<T[]>,
  {enabled = true, query = ''}: {enabled?: boolean; query?: string} = {}
): CandidateSearchResult<T> {
  const [candidates, setCandidates] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [reloadKey, setReloadKey] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!enabled) {
      setCandidates([]);
      setFailed(false);
      setLoaded(false);
      return;
    }
    let mounted = true;
    setLoading(true);
    fetcherRef.current(debouncedQuery.trim())
      .then((list) => {
        if (!mounted) return;
        setCandidates(list);
        setFailed(false);
        setLoaded(true);
      })
      .catch(() => {
        if (!mounted) return;
        setCandidates([]);
        setFailed(true);
        setLoaded(true);
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [scopeKey, enabled, debouncedQuery, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  return useMemo(
    () => ({candidates, loading, loaded, failed, truncated: candidates.length >= CANDIDATE_LIMIT, reload}),
    [candidates, loading, loaded, failed, reload]
  );
}
