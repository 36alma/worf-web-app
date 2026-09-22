'use client';

import {useEffect, useState} from 'react';
import {getUserGroups} from '@/lib/api/groups';
import {parseUserGroups, type UserGroupSummary} from '@/lib/utils/userGroups';

const TTL_MS = 5 * 60 * 1000;
let cache: {at: number; groups: UserGroupSummary[]} | null = null;
/** Widgets mounting together all ask at once; they share the one request instead of each sending their own. */
let inflight: Promise<UserGroupSummary[]> | null = null;

const freshGroups = () => (cache && Date.now() - cache.at < TTL_MS ? cache.groups : null);

function loadGroups(): Promise<UserGroupSummary[]> {
  inflight ??= getUserGroups()
    .then(({data}) => {
      const groups = parseUserGroups(data);
      cache = {at: Date.now(), groups};
      return groups;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export interface UseUserGroupsResult {
  groups: UserGroupSummary[];
  loading: boolean;
  failed: boolean;
}

/** The groups the signed-in user belongs to (`id` in its raw form + `name`), fetched once and cached for a few minutes. */
export function useUserGroups(enabled = true): UseUserGroupsResult {
  const [groups, setGroups] = useState<UserGroupSummary[]>(freshGroups() ?? []);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const cached = freshGroups();
    if (cached) {
      setGroups(cached);
      return;
    }
    let mounted = true;
    setLoading(true);
    loadGroups()
      .then((list) => {
        if (!mounted) return;
        setGroups(list);
        setFailed(false);
      })
      .catch(() => mounted && setFailed(true))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [enabled]);

  return {groups, loading, failed};
}
