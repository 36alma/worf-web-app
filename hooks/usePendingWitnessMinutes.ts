'use client';

import {useEffect, useState} from 'react';
import type {MeetingMinutes, MinutesListResponse} from '@/components/groups/minutes/types';
import {getUserGroups} from '@/lib/api/groups';
import {listAllPendingWitnessMinutes} from '@/lib/api/minutes';
import {normalizeGroupId} from '@/lib/utils/groupId';
import {parseUserGroups} from '@/lib/utils/userGroups';

const GROUP_NAMES_TTL_MS = 5 * 60 * 1000;
let groupNamesCache: {at: number; names: Record<string, string>} | null = null;

/** `group_id` → name. `witness/pending/all` only carries the id, so the name comes from the group list (cached). */
async function loadGroupNames(): Promise<Record<string, string>> {
  if (groupNamesCache && Date.now() - groupNamesCache.at < GROUP_NAMES_TTL_MS) return groupNamesCache.names;
  const {data} = await getUserGroups();
  const names = Object.fromEntries(parseUserGroups(data).map((group) => [group.id, group.name]));
  groupNamesCache = {at: Date.now(), names};
  return names;
}

export interface UsePendingWitnessMinutesOptions {
  /** Skip the request (e.g. while nobody is signed in). */
  enabled?: boolean;
  /** How many records to bring; `total` is the full count either way, so `1` is enough for a badge. */
  loadNumber?: number;
  /**
   * Also resolve the group names through the group list (one extra, cached request) — only for records that came
   * without a `group_name`; the witness lists send it, so normally nothing extra is fetched.
   */
  withGroupNames?: boolean;
  /** Refetch whenever this changes (e.g. the route), so a vote is reflected once the user is back. */
  refreshKey?: string;
}

export interface UsePendingWitnessMinutesResult {
  minutes: MeetingMinutes[];
  /** `total_minutes`: every record awaiting the caller's vote, in every group — the badge number. */
  total: number;
  /** Opaque `group_id` → group name; empty until (and unless) `withGroupNames` resolved. */
  groupNames: Record<string, string>;
  loading: boolean;
  failed: boolean;
}

/**
 * The global "to do": minutes in `PENDING_APPROVAL` where the signed-in user is a witness who has not voted,
 * across all groups (`witness/pending/all`). The server only lists groups the user is a current, entitled member of.
 */
export function usePendingWitnessMinutes({
  enabled = true,
  loadNumber = 20,
  withGroupNames = false,
  refreshKey = ''
}: UsePendingWitnessMinutesOptions = {}): UsePendingWitnessMinutesResult {
  const [minutes, setMinutes] = useState<MeetingMinutes[]>([]);
  const [total, setTotal] = useState(0);
  const [groupNames, setGroupNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let mounted = true;
    setLoading(true);
    listAllPendingWitnessMinutes({page_number: 1, load_number: loadNumber})
      .then(({data}) => {
        if (!mounted) return;
        const payload = data as Partial<MinutesListResponse>;
        const list = (payload.minutes ?? []).map((item) => ({...item, group_id: normalizeGroupId(item.group_id)}));
        setMinutes(list);
        setTotal(typeof payload.total_minutes === 'number' ? payload.total_minutes : list.length);
        setFailed(false);
      })
      .catch(() => {
        if (!mounted) return;
        setMinutes([]);
        setTotal(0);
        setFailed(true);
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [enabled, loadNumber, refreshKey]);

  useEffect(() => {
    if (!enabled || !withGroupNames || minutes.length === 0) return;
    if (minutes.every((item) => item.group_name)) return;
    let mounted = true;
    loadGroupNames()
      .then((names) => mounted && setGroupNames(names))
      .catch(() => mounted && setGroupNames({}));
    return () => {
      mounted = false;
    };
  }, [enabled, withGroupNames, minutes]);

  return {minutes, total, groupNames, loading, failed};
}
