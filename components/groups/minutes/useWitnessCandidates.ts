'use client';

import {listWitnessCandidates} from '@/lib/api/minutes';
import type {WitnessCandidate} from './types';
import {CANDIDATE_LIMIT, useCandidateSearch, type CandidateSearchResult} from './useCandidateSearch';

/** The server caps `limit` at 50 — above that the list is narrowed with `query` instead. */
export const WITNESS_CANDIDATE_LIMIT = CANDIDATE_LIMIT;

export function parseWitnessCandidates(payload: unknown): WitnessCandidate[] {
  const list = (payload as {candidates?: unknown} | undefined)?.candidates;
  if (!Array.isArray(list)) return [];
  return list
    .map((item): WitnessCandidate | null => {
      if (!item || typeof item !== 'object') return null;
      const raw = item as Record<string, unknown>;
      const userId = String(raw.user_id ?? '').trim();
      if (!userId) return null;
      return {
        user_id: userId,
        username: raw.username ? String(raw.username) : null,
        full_name: raw.full_name ? String(raw.full_name) : null,
        participant_id: raw.participant_id ? String(raw.participant_id) : null,
        participant_role: (raw.participant_role as WitnessCandidate['participant_role']) ?? null
      };
    })
    .filter((c): c is WitnessCandidate => c !== null);
}

/**
 * One-shot fetch (no React state). Without a `minutesId` (the import review — no record yet) the answer is
 * the group-level list: no `participant_*` fields, and the minute taker is not left out.
 */
export async function fetchWitnessCandidates(
  groupId: string,
  minutesId?: string,
  query?: string
): Promise<WitnessCandidate[]> {
  const {data} = await listWitnessCandidates({
    group_id: groupId,
    minutes_id: minutesId || undefined,
    query: query || undefined,
    limit: WITNESS_CANDIDATE_LIMIT
  });
  return parseWitnessCandidates(data);
}

export type UseWitnessCandidatesResult = CandidateSearchResult<WitnessCandidate>;

/** `witness/candidates` with a debounced query. Skipped entirely while `enabled` is false. */
export function useWitnessCandidates(
  groupId: string,
  minutesId: string | undefined,
  {enabled = true, query = ''}: {enabled?: boolean; query?: string} = {}
): UseWitnessCandidatesResult {
  return useCandidateSearch(
    `${groupId}|${minutesId ?? ''}`,
    (q) => fetchWitnessCandidates(groupId, minutesId, q),
    {enabled: enabled && !!groupId, query}
  );
}
