'use client';

import {listMinuteTakerCandidates} from '@/lib/api/minutes';
import type {MinuteTakerCandidate} from './types';
import {CANDIDATE_LIMIT, useCandidateSearch, type CandidateSearchResult} from './useCandidateSearch';

export function parseMinuteTakerCandidates(payload: unknown): MinuteTakerCandidate[] {
  const list = (payload as {candidates?: unknown} | undefined)?.candidates;
  if (!Array.isArray(list)) return [];
  return list
    .map((item): MinuteTakerCandidate | null => {
      if (!item || typeof item !== 'object') return null;
      const raw = item as Record<string, unknown>;
      const userId = String(raw.user_id ?? '').trim();
      if (!userId) return null;
      return {
        user_id: userId,
        username: raw.username ? String(raw.username) : null,
        full_name: raw.full_name ? String(raw.full_name) : null
      };
    })
    .filter((c): c is MinuteTakerCandidate => c !== null);
}

export async function fetchMinuteTakerCandidates(
  groupId: string,
  minutesId?: string,
  query?: string
): Promise<MinuteTakerCandidate[]> {
  const {data} = await listMinuteTakerCandidates({
    group_id: groupId,
    minutes_id: minutesId || undefined,
    query: query || undefined,
    limit: CANDIDATE_LIMIT
  });
  return parseMinuteTakerCandidates(data);
}

/**
 * `minute-taker/candidates`: active members whose role has `group.minutes.modify`. Without a `minutesId`
 * (the create form) it is the group-level list; with one, the record's current witnesses are left out.
 */
export function useMinuteTakerCandidates(
  groupId: string,
  minutesId: string | undefined,
  {query = ''}: {query?: string} = {}
): CandidateSearchResult<MinuteTakerCandidate> {
  return useCandidateSearch(
    `${groupId}|${minutesId ?? ''}`,
    (q) => fetchMinuteTakerCandidates(groupId, minutesId, q),
    {enabled: !!groupId, query}
  );
}
